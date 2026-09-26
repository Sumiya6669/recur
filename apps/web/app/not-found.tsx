import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-block"><Logo /></Link>
        <h1 className="display mt-10 text-[40px] font-semibold">This page isn't here</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          If you followed a checkout link, ask the business for a new one. The plan may have been replaced.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">Home</Link>
          <Link href="/account" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">My subscriptions</Link>
        </div>
      </div>
    </div>
  );
}
