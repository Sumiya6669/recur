//! Recur — non-custodial recurring payments (subscriptions) in stablecoins on Solana.
//!
//! How it works:
//! 1. The subscriber approves ONE global program PDA (`delegate`) as the delegate of their
//!    token account for a bounded amount (e.g. price x 12). SPL Token allows only one
//!    delegate per token account, so a single global delegate lets one wallet hold many
//!    subscriptions at once. Per-subscription limits are enforced by this program.
//! 2. `subscribe` records the subscriber's consent on-chain (locked price + period) and
//!    collects the first payment immediately.
//! 3. `charge` is permissionless: anyone (our keeper, the merchant, a third party) can
//!    trigger it once a period is due. Funds go only to the merchant's settlement account.
//! 4. `cancel` can be called by the subscriber or the merchant at any time.
//!
//! Each subscription also carries its own `budget_remaining`: the most it may still collect. The
//! approval on the token account is shared by every subscription on it, so without a per-subscription
//! budget a short-period plan could use up allowance meant for the wallet's other subscriptions.
//! `charge` spends the budget; only the subscriber can raise it with `extend`.
//!
//! A subscription is "active" off-chain when `now < next_charge_at + grace_secs`.
//! A failed charge (no funds, revoked approval) simply leaves the account unpaid, and it
//! lapses after the grace period. No extra instruction is needed.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA");

pub const DELEGATE_SEED: &[u8] = b"delegate";
pub const MERCHANT_SEED: &[u8] = b"merchant";
pub const PLAN_SEED: &[u8] = b"plan";
pub const SUBSCRIPTION_SEED: &[u8] = b"subscription";

/// Minimum billing period. Kept low so devnet demos can show several charges in minutes.
pub const MIN_PERIOD_SECS: i64 = 60;
pub const MAX_GRACE_SECS: i64 = 30 * 24 * 60 * 60;

#[program]
pub mod recur {
    use super::*;

    /// Register a merchant. `settlement_wallet` is the owner of the token accounts that
    /// receive payments (can be a Squads multisig vault).
    pub fn init_merchant(
        ctx: Context<InitMerchant>,
        settlement_wallet: Pubkey,
        name: [u8; 32],
    ) -> Result<()> {
        let merchant = &mut ctx.accounts.merchant;
        merchant.authority = ctx.accounts.authority.key();
        merchant.settlement_wallet = settlement_wallet;
        merchant.name = name;
        merchant.plan_count = 0;
        merchant.bump = ctx.bumps.merchant;
        Ok(())
    }

    pub fn update_merchant(
        ctx: Context<MerchantAdmin>,
        settlement_wallet: Pubkey,
        name: [u8; 32],
    ) -> Result<()> {
        let merchant = &mut ctx.accounts.merchant;
        merchant.settlement_wallet = settlement_wallet;
        merchant.name = name;
        Ok(())
    }

    /// Create a pricing plan (e.g. 10 USDC every 30 days).
    pub fn create_plan(
        ctx: Context<CreatePlan>,
        amount: u64,
        period_secs: i64,
        grace_secs: i64,
        name: [u8; 32],
    ) -> Result<()> {
        require!(amount > 0, RecurError::InvalidAmount);
        // MVP: classic SPL Token mints only (USDC). Token-2022 extensions such as transfer
        // fees, transfer hooks or permanent delegates would break the "exact amount" guarantee.
        require_keys_eq!(
            *ctx.accounts.mint.to_account_info().owner,
            anchor_spl::token::ID,
            RecurError::UnsupportedMint
        );
        require!(period_secs >= MIN_PERIOD_SECS, RecurError::InvalidPeriod);
        require!(
            (0..=MAX_GRACE_SECS).contains(&grace_secs),
            RecurError::InvalidGrace
        );

        let merchant = &mut ctx.accounts.merchant;
        let plan = &mut ctx.accounts.plan;
        plan.merchant = merchant.key();
        plan.id = merchant.plan_count;
        plan.mint = ctx.accounts.mint.key();
        plan.amount = amount;
        plan.period_secs = period_secs;
        plan.grace_secs = grace_secs;
        plan.active = true;
        plan.subscriber_count = 0;
        plan.name = name;
        plan.bump = ctx.bumps.plan;

        merchant.plan_count = merchant
            .plan_count
            .checked_add(1)
            .ok_or(RecurError::MathOverflow)?;

        emit!(PlanCreated {
            merchant: plan.merchant,
            plan: plan.key(),
            mint: plan.mint,
            amount,
            period_secs,
        });
        Ok(())
    }

    /// Pause/resume new sign-ups. Existing subscriptions keep their locked terms.
    pub fn set_plan_active(ctx: Context<PlanAdmin>, active: bool) -> Result<()> {
        ctx.accounts.plan.active = active;
        Ok(())
    }

    /// Subscribe and pay the first period. The client must put an SPL `approve`
    /// (delegate = delegate PDA) before this instruction in the same transaction.
    /// `max_cycles` caps the total number of payments (0 = until cancelled).
    /// `budget` is the most this subscription may collect after the first payment; the
    /// subscriber raises it later with `extend`.
    pub fn subscribe(ctx: Context<Subscribe>, max_cycles: u64, budget: u64) -> Result<()> {
        let plan = &ctx.accounts.plan;
        require!(plan.active, RecurError::PlanInactive);

        let now = Clock::get()?.unix_timestamp;
        let sub = &mut ctx.accounts.subscription;
        sub.plan = plan.key();
        sub.merchant = plan.merchant;
        sub.subscriber = ctx.accounts.subscriber.key();
        sub.subscriber_token_account = ctx.accounts.subscriber_token_account.key();
        sub.mint = plan.mint;
        sub.amount = plan.amount;
        sub.period_secs = plan.period_secs;
        sub.grace_secs = plan.grace_secs;
        sub.created_at = now;
        sub.last_charged_at = now;
        sub.next_charge_at = now
            .checked_add(plan.period_secs)
            .ok_or(RecurError::MathOverflow)?;
        sub.cycles_paid = 1;
        sub.max_cycles = max_cycles;
        sub.bump = ctx.bumps.subscription;
        sub.budget_remaining = budget;

        let amount = sub.amount;
        let delegate_bump = ctx.bumps.delegate;
        pull_payment(
            &ctx.accounts.token_program,
            &ctx.accounts.subscriber_token_account,
            &ctx.accounts.mint,
            &ctx.accounts.merchant_token_account,
            &ctx.accounts.delegate,
            delegate_bump,
            amount,
        )?;

        let plan = &mut ctx.accounts.plan;
        plan.subscriber_count = plan.subscriber_count.saturating_add(1);

        emit!(Subscribed {
            subscription: sub.key(),
            plan: sub.plan,
            subscriber: sub.subscriber,
            amount,
            next_charge_at: sub.next_charge_at,
        });
        emit!(PaymentCollected {
            subscription: sub.key(),
            plan: sub.plan,
            subscriber: sub.subscriber,
            amount,
            cycle: 1,
            next_charge_at: sub.next_charge_at,
        });
        Ok(())
    }

    /// Collect a due payment. Permissionless.
    pub fn charge(ctx: Context<Charge>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let sub = &mut ctx.accounts.subscription;
        require!(
            sub.max_cycles == 0 || sub.cycles_paid < sub.max_cycles,
            RecurError::SubscriptionCompleted
        );
        require!(now >= sub.next_charge_at, RecurError::NotDue);
        sub.budget_remaining = sub
            .budget_remaining
            .checked_sub(sub.amount)
            .ok_or(RecurError::BudgetExhausted)?;

        // Late but within grace: keep the original schedule.
        // Lapsed beyond grace: start a fresh period from now (no back-billing).
        let lapse_deadline = sub
            .next_charge_at
            .checked_add(sub.grace_secs)
            .ok_or(RecurError::MathOverflow)?;
        let base = if now > lapse_deadline { now } else { sub.next_charge_at };
        sub.next_charge_at = base
            .checked_add(sub.period_secs)
            .ok_or(RecurError::MathOverflow)?;
        sub.last_charged_at = now;
        sub.cycles_paid = sub
            .cycles_paid
            .checked_add(1)
            .ok_or(RecurError::MathOverflow)?;

        let amount = sub.amount;
        let delegate_bump = ctx.bumps.delegate;
        pull_payment(
            &ctx.accounts.token_program,
            &ctx.accounts.subscriber_token_account,
            &ctx.accounts.mint,
            &ctx.accounts.merchant_token_account,
            &ctx.accounts.delegate,
            delegate_bump,
            amount,
        )?;

        emit!(PaymentCollected {
            subscription: sub.key(),
            plan: sub.plan,
            subscriber: sub.subscriber,
            amount,
            cycle: sub.cycles_paid,
            next_charge_at: sub.next_charge_at,
        });
        Ok(())
    }

    /// Raise this subscription's budget. Only the subscriber can do it; the client should raise
    /// the token approval by the same amount in the same transaction.
    pub fn extend(ctx: Context<Extend>, additional: u64) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        sub.budget_remaining = sub
            .budget_remaining
            .checked_add(additional)
            .ok_or(RecurError::MathOverflow)?;
        emit!(BudgetExtended {
            subscription: sub.key(),
            subscriber: sub.subscriber,
            additional,
            budget_remaining: sub.budget_remaining,
        });
        Ok(())
    }

    /// Cancel by subscriber or merchant. Rent goes back to the subscriber.
    /// The client should also revoke / decrease the token approval if no other
    /// subscriptions rely on it.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let sub = &ctx.accounts.subscription;
        require!(
            signer == sub.subscriber || signer == ctx.accounts.merchant.authority,
            RecurError::Unauthorized
        );

        let plan = &mut ctx.accounts.plan;
        plan.subscriber_count = plan.subscriber_count.saturating_sub(1);

        emit!(Cancelled {
            subscription: sub.key(),
            plan: sub.plan,
            subscriber: sub.subscriber,
            by_merchant: signer != sub.subscriber,
        });
        Ok(())
    }
}

fn pull_payment<'info>(
    token_program: &Interface<'info, TokenInterface>,
    from: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    to: &InterfaceAccount<'info, TokenAccount>,
    delegate: &UncheckedAccount<'info>,
    delegate_bump: u8,
    amount: u64,
) -> Result<()> {
    // Friendly errors before the CPI (the token program would fail anyway).
    require!(
        from.delegate.contains(&delegate.key()),
        RecurError::DelegateNotApproved
    );
    require!(
        from.delegated_amount >= amount,
        RecurError::InsufficientAllowance
    );
    require!(from.amount >= amount, RecurError::InsufficientFunds);

    let seeds: &[&[u8]] = &[DELEGATE_SEED, &[delegate_bump]];
    let signer_seeds = &[seeds];
    let cpi_ctx = CpiContext::new_with_signer(
        token_program.key(),
        TransferChecked {
            from: from.to_account_info(),
            mint: mint.to_account_info(),
            to: to.to_account_info(),
            authority: delegate.to_account_info(),
        },
        signer_seeds,
    );
    token_interface::transfer_checked(cpi_ctx, amount, mint.decimals)
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Merchant::INIT_SPACE,
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump
    )]
    pub merchant: Account<'info, Merchant>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MerchantAdmin<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub merchant: Account<'info, Merchant>,
}

#[derive(Accounts)]
pub struct CreatePlan<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub merchant: Account<'info, Merchant>,
    #[account(
        init,
        payer = authority,
        space = 8 + Plan::INIT_SPACE,
        seeds = [PLAN_SEED, merchant.key().as_ref(), &merchant.plan_count.to_le_bytes()],
        bump
    )]
    pub plan: Account<'info, Plan>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlanAdmin<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub merchant: Account<'info, Merchant>,
    #[account(mut, has_one = merchant)]
    pub plan: Account<'info, Plan>,
}

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    pub merchant: Account<'info, Merchant>,
    #[account(mut, has_one = merchant, has_one = mint)]
    pub plan: Account<'info, Plan>,
    #[account(
        init,
        payer = subscriber,
        space = 8 + Subscription::INIT_SPACE,
        seeds = [SUBSCRIPTION_SEED, plan.key().as_ref(), subscriber.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = subscriber,
        token::token_program = token_program,
    )]
    pub subscriber_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = merchant.settlement_wallet,
        token::token_program = token_program,
    )]
    pub merchant_token_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: PDA used only as a token-delegate signer; holds no data.
    #[account(seeds = [DELEGATE_SEED], bump)]
    pub delegate: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Charge<'info> {
    /// Anyone can crank a due payment.
    pub cranker: Signer<'info>,
    pub merchant: Account<'info, Merchant>,
    #[account(
        mut,
        has_one = merchant,
        has_one = mint,
        has_one = subscriber_token_account,
        seeds = [SUBSCRIPTION_SEED, subscription.plan.as_ref(), subscription.subscriber.as_ref()],
        bump = subscription.bump,
    )]
    pub subscription: Account<'info, Subscription>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::token_program = token_program)]
    pub subscriber_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = merchant.settlement_wallet,
        token::token_program = token_program,
    )]
    pub merchant_token_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: PDA used only as a token-delegate signer; holds no data.
    #[account(seeds = [DELEGATE_SEED], bump)]
    pub delegate: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Extend<'info> {
    pub subscriber: Signer<'info>,
    #[account(
        mut,
        has_one = subscriber,
        seeds = [SUBSCRIPTION_SEED, subscription.plan.as_ref(), subscriber.key().as_ref()],
        bump = subscription.bump,
    )]
    pub subscription: Account<'info, Subscription>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    pub signer: Signer<'info>,
    pub merchant: Account<'info, Merchant>,
    #[account(mut, has_one = merchant)]
    pub plan: Account<'info, Plan>,
    #[account(
        mut,
        has_one = plan,
        has_one = subscriber,
        close = subscriber,
    )]
    pub subscription: Account<'info, Subscription>,
    /// CHECK: receives the rent refund; verified via `has_one = subscriber`.
    #[account(mut)]
    pub subscriber: UncheckedAccount<'info>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Merchant {
    pub authority: Pubkey,
    pub settlement_wallet: Pubkey,
    pub plan_count: u64,
    /// UTF-8, zero-padded display name.
    pub name: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Plan {
    pub merchant: Pubkey,
    pub id: u64,
    pub mint: Pubkey,
    pub amount: u64,
    pub period_secs: i64,
    pub grace_secs: i64,
    pub active: bool,
    pub subscriber_count: u64,
    /// UTF-8, zero-padded display name.
    pub name: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub plan: Pubkey,
    pub merchant: Pubkey,
    pub subscriber: Pubkey,
    pub subscriber_token_account: Pubkey,
    pub mint: Pubkey,
    /// Price locked at subscribe time; plan changes don't affect existing subscribers.
    pub amount: u64,
    pub period_secs: i64,
    pub grace_secs: i64,
    pub created_at: i64,
    pub last_charged_at: i64,
    pub next_charge_at: i64,
    pub cycles_paid: u64,
    /// 0 = until cancelled.
    pub max_cycles: u64,
    pub bump: u8,
    /// Most this subscription may still collect. Appended last so earlier field offsets stay put.
    pub budget_remaining: u64,
}

// ---------------------------------------------------------------------------
// Events (indexed by the backend -> merchant webhooks)
// ---------------------------------------------------------------------------

#[event]
pub struct PlanCreated {
    pub merchant: Pubkey,
    pub plan: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub period_secs: i64,
}

#[event]
pub struct Subscribed {
    pub subscription: Pubkey,
    pub plan: Pubkey,
    pub subscriber: Pubkey,
    pub amount: u64,
    pub next_charge_at: i64,
}

#[event]
pub struct PaymentCollected {
    pub subscription: Pubkey,
    pub plan: Pubkey,
    pub subscriber: Pubkey,
    pub amount: u64,
    pub cycle: u64,
    pub next_charge_at: i64,
}

#[event]
pub struct BudgetExtended {
    pub subscription: Pubkey,
    pub subscriber: Pubkey,
    pub additional: u64,
    pub budget_remaining: u64,
}

#[event]
pub struct Cancelled {
    pub subscription: Pubkey,
    pub plan: Pubkey,
    pub subscriber: Pubkey,
    pub by_merchant: bool,
}

#[error_code]
pub enum RecurError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Billing period is too short")]
    InvalidPeriod,
    #[msg("Grace period is out of range")]
    InvalidGrace,
    #[msg("Plan is not accepting new subscribers")]
    PlanInactive,
    #[msg("Payment is not due yet")]
    NotDue,
    #[msg("Program delegate is not approved on the subscriber token account")]
    DelegateNotApproved,
    #[msg("Remaining allowance is lower than the payment amount")]
    InsufficientAllowance,
    #[msg("Subscriber balance is too low")]
    InsufficientFunds,
    #[msg("Only the subscriber or the merchant can do this")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("All scheduled payments have been collected")]
    SubscriptionCompleted,
    #[msg("Only classic SPL Token mints (e.g. USDC) are supported")]
    UnsupportedMint,
    #[msg("This subscription's budget is used up; the subscriber must extend it")]
    BudgetExhausted,
}
