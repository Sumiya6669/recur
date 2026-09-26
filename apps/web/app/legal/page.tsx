import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { CLUSTER } from "@/lib/config";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).t.legal.title };
}

export default async function Legal() {
  const { t } = await getT();
  const l = t.legal;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
        <h1 className="display text-[clamp(34px,5vw,52px)] font-semibold">{l.title}</h1>
        <p className="mt-2 text-[15px] text-mute">{l.lead}</p>

        {CLUSTER !== "mainnet" && (
          <p className="mt-8 rounded-2xl border border-amber/30 bg-amber/5 p-4 text-[14px] text-amber">{l.devnet(CLUSTER)}</p>
        )}

        {l.sections.map(([title, paragraphs]) => (
          <section key={title} className="mt-10">
            <h2 className="display text-[24px] font-semibold">{title}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-mute">
              {paragraphs.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  );
}
