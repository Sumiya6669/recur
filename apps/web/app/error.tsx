"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-block"><Logo /></Link>
        <h1 className="display mt-10 text-[40px] font-semibold">Something broke on this page</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          Nothing was sent from your wallet. Try again. If it keeps happening, a browser extension or page translation may be
          changing the page; open it in a private window.
        </p>
        {error.digest && <p className="mt-3 font-mono text-[12px] text-dim">Reference {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">Try again</button>
          <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">Home</Link>
        </div>
      </div>
    </div>
  );
}
