import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/src/components/LegalPage";

export const metadata: Metadata = { title: "Support · ChoreQuest" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I invite my partner or roommates?",
    a: (
      <>
        Open the <strong>Household</strong> tab and tap <strong>Share invite</strong>. They can tap the link, or sign up
        and enter the 6-letter code.
      </>
    ),
  },
  {
    q: "How are points counted?",
    a: "Each chore is worth points based on effort (Quick 10 up to Epic 60). Undone chores don't count. The leaderboard shows this week, this month or all time.",
  },
  {
    q: "What are coins?",
    a: "Every point you earn is also a coin you can spend in the rewards shop. Spending coins doesn't lower your leaderboard score.",
  },
  {
    q: "I forgot my password",
    a: (
      <>
        On the sign-in screen tap <strong>Forgot password?</strong> and we&apos;ll email you a reset link. Check your
        spam folder too.
      </>
    ),
  },
  {
    q: "How do I cancel ChoreQuest Plus?",
    a: "Subscriptions are managed by Apple or Google: iPhone → Settings → your name → Subscriptions, or Google Play → Profile → Payments & subscriptions. Deleting the app doesn't cancel it.",
  },
  {
    q: "How do I delete my account?",
    a: (
      <>
        Profile → <strong>Delete account</strong>. This permanently removes your sign-in and profile. See the{" "}
        <Link href="/privacy">Privacy Policy</Link> for what happens to shared household data.
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <LegalPage title="Help & support" intro="Answers to common questions. Still stuck? We're happy to help.">
      {FAQ.map((item) => (
        <section key={item.q}>
          <h2>{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}
      <section>
        <h2>Contact us</h2>
        <p>
          Email <ContactEmail />. We usually reply within two working days.
        </p>
      </section>
    </LegalPage>
  );
}
