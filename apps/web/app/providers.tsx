"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { RPC_URL } from "@/lib/config";
import { ConnectDialog } from "@/components/ConnectDialog";

type Toast = { id: number; tone: "ok" | "error" | "info"; title: string; body?: string; href?: string };
type UI = {
  openConnect: () => void;
  toast: (t: Omit<Toast, "id">) => void;
};
const UIContext = createContext<UI | null>(null);
export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI outside Providers");
  return ctx;
};

export function Providers({ children }: { children: ReactNode }) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.tone === "error" ? 9000 : 6000);
  }, []);
  const ui = useMemo(() => ({ openConnect: () => setConnectOpen(true), toast }), [toast]);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <UIContext.Provider value={ui}>
          {children}
          <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }} aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id}
                className="toast-in pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-raise/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${t.tone === "ok" ? "bg-usdc" : t.tone === "error" ? "bg-coral" : "bg-mute"}`} />
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-fg">{t.title}</div>
                    {t.body && <div className="mt-0.5 text-[13px] text-mute">{t.body}</div>}
                    {t.href && (
                      <a href={t.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] text-usdc-soft underline-offset-4 hover:underline">
                        View on Solana Explorer
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </UIContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
