import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-block"><Logo /></Link>
        <h1 className="display mt-10 text-[40px] font-semibold">{t.errorsPage.notFoundTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">{t.errorsPage.notFoundBody}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">{t.common.home}</Link>
          <Link href="/account" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">{t.common.mySubscriptions}</Link>
        </div>
      </div>
    </div>
  );
}
