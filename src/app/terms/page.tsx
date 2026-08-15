import type { Metadata } from "next";
import PolicyLayout from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "Terms of Service — DareStake",
  description:
    "The terms for using DareStake, including how fines and the Gold Jar work.",
};

const CONTACT = "shivansh.goela13@gmail.com";

export default function TermsPage() {
  return (
    <PolicyLayout title="Terms of Service" updated="15 August 2026">
      <p>
        By using DareStake you agree to these terms. If you do not agree, please
        do not use the app.
      </p>

      <h2>What DareStake is</h2>
      <p>
        DareStake pairs exactly two people who assign each other daily dares. If
        a dare is not marked complete before its deadline, the app adds a random
        amount up to a limit you both agree on to a shared running total called
        the Gold Jar.
      </p>

      <h2>The Gold Jar is a tally, not a payment system</h2>
      <p>
        This is the most important thing on this page.{" "}
        <strong>
          DareStake does not process, hold, transfer, or collect money.
        </strong>{" "}
        The rupee figures shown in the app are a scorekeeping device. No card,
        bank, or UPI details are requested, and nothing is ever charged.
      </p>
      <p>
        Whether you and your partner choose to settle the total between
        yourselves in real money is entirely a private arrangement between the
        two of you. DareStake is not a party to it, takes no fee, provides no
        escrow, offers no dispute resolution for it, and has no way to enforce or
        reverse it. We are not a financial service, payment processor, wallet,
        lender, or gambling operator.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 13 years old to use DareStake. If you intend to
        settle any real money with your partner on the basis of the app&rsquo;s
        tally, you must be an adult in your jurisdiction and it is your own
        responsibility to ensure doing so is lawful where you live.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>
          You sign in with Google and are responsible for keeping that account
          secure
        </li>
        <li>
          One account, one person. Do not impersonate anyone or create accounts
          for others
        </li>
        <li>
          You are responsible for everything created under your account
        </li>
      </ul>

      <h2>Pairing</h2>
      <p>
        An account can be paired with one partner at a time. Invite codes expire
        after 24 hours and are single-use — treat a code as a credential, since
        anyone holding it can pair with you. Either partner can unpair at any
        time from their profile, which ends the pairing for both.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not use DareStake to:</p>
      <ul>
        <li>
          Assign dares that are illegal, dangerous, self-harming, degrading, or
          coercive
        </li>
        <li>Harass, threaten, or pressure your partner</li>
        <li>
          Upload photo proof containing unlawful content or anyone else&rsquo;s
          private information
        </li>
        <li>
          Attempt to access data belonging to a pair you are not part of, or
          otherwise circumvent the app&rsquo;s security rules
        </li>
        <li>
          Automate, scrape, or overload the service
        </li>
      </ul>
      <p>
        You and your partner are solely responsible for the dares you set each
        other. Consider what you are agreeing to before accepting a dare.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of everything you create — dare text, descriptions,
        and photo proof. You grant only the permission technically required to
        operate the app: to store your data, show it to your paired partner, and
        display it back to you. Photo proof is stored in your own Google Drive,
        not on our servers.
      </p>

      <h2>Availability</h2>
      <p>
        DareStake is a personal project offered free of charge and provided{" "}
        <strong>as is</strong>, with no uptime guarantee. It may be changed,
        interrupted, or discontinued at any time without notice. Features may be
        added or removed. Please do not depend on it for anything critical.
      </p>
      <p>
        We make reasonable efforts to keep your data intact but do not guarantee
        against loss. The penalty engine runs in your browser rather than on a
        server, so a fine is applied when the app is next opened after a missed
        deadline — not at the instant the deadline passes.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, DareStake and its author are not
        liable for any indirect, incidental, or consequential damages, for lost
        data, for any dispute between you and your partner, or for any money you
        choose to exchange with each other. Nothing here limits liability that
        cannot be limited by law.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using DareStake at any time; see the{" "}
        <a href="/privacy">Privacy Policy</a> for how to request deletion. We may
        suspend access that breaks these terms or harms the service or its users.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated; the &ldquo;last updated&rdquo; date above
        will change when they are. Continuing to use the app after a change means
        you accept the revised terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India. DareStake operates on a
        single timezone — India Standard Time (UTC+05:30) — and all dare dates
        and deadlines are calculated in IST regardless of where you are.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </PolicyLayout>
  );
}
