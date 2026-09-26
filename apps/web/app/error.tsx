"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  const e = t.errorsPage;
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-block"><Logo /></Link>
        <h1 className="display mt-10 text-[40px] font-semibold">{e.errorTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          {e.errorBody}
        </p>
        {error.digest && <p className="mt-3 font-mono text-[12px] text-dim">{e.reference(error.digest)}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">{e.tryAgain}</button>
          <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">{t.common.home}</Link>
        </div>
      </div>
    </div>
  );
}
