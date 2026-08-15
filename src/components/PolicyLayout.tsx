import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared chrome for the legal pages (/privacy, /terms).
 *
 * Deliberately plain: no auth, no Firestore, no client hooks. These pages must
 * render for a signed-out visitor and for crawlers -- Google's OAuth consent
 * screen review fetches the privacy policy URL directly.
 */
export default function PolicyLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#0D0D0D] text-[#F5F5F5]">
      <header className="border-b border-[#2A2A2A]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#737373] hover:text-[#F5F5F5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-lg font-black text-[#FF6B35]">DareStake</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 pb-20">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-[#737373] mt-2">Last updated {updated}</p>

        <div
          className="mt-8 space-y-6
            [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#F5F5F5] [&_h2]:mt-10 [&_h2]:mb-3
            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[#F5F5F5] [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-[#A3A3A3]
            [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-[#A3A3A3]
            [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc
            [&_strong]:text-[#F5F5F5] [&_strong]:font-semibold
            [&_a]:text-[#FF6B35] [&_a]:underline [&_a]:underline-offset-2
            [&_code]:text-[#FF6B35] [&_code]:text-xs [&_code]:bg-[#1A1A1A] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded"
        >
          {children}
        </div>

        <div className="mt-14 pt-6 border-t border-[#2A2A2A] flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#737373]">
          <Link href="/privacy" className="hover:text-[#F5F5F5] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[#F5F5F5] transition-colors">
            Terms of Service
          </Link>
          <Link href="/" className="hover:text-[#F5F5F5] transition-colors">
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
