import type { Metadata } from "next";
import { ContactEmail, LegalPage } from "@/src/components/LegalPage";
import { LEGAL } from "@/src/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · ChoreQuest" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${LEGAL.appName} helps households share chores. This policy explains what data we collect, why, who can see it and the choices you have. In short: we collect only what the app needs, we never sell your data, and there are no ads.`}>
      <section>
        <h2>Who is responsible</h2>
        <p>
          {LEGAL.appName} is provided by {LEGAL.operator} (&quot;we&quot;), based in {LEGAL.country}, who is the data
          controller for your personal data. Contact: <ContactEmail />.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account:</strong> your email address and sign-in method. If you use Sign in with Apple or Google, we
            receive an account identifier and, if you allow it, your name and email. Passwords are handled by Firebase
            Authentication; we never see them.
          </li>
          <li>
            <strong>Profile:</strong> the display name and avatar emoji you choose.
          </li>
          <li>
            <strong>Household content:</strong> the household name and invite code, its members, the chores you create,
            and when chores are completed, skipped or undone (and by whom), plus rewards and redemptions.
          </li>
          <li>
            <strong>Device:</strong> a push notification token, only if you turn on notifications. Daily reminder settings
            stay on your device.
          </li>
          <li>
            <strong>Purchases:</strong> if you subscribe to ChoreQuest Plus, Apple or Google process the payment. We and
            our subscription provider receive the subscription status and product, never your card details.
          </li>
          <li>
            <strong>Usage statistics (optional):</strong> only if you switch on &quot;Share anonymous usage stats&quot; in
            Profile: which screens are opened, when a chore is completed, and app errors. Never chore names or personal
            details.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To provide the app and keep your household in sync (necessary to perform our agreement with you).</li>
          <li>To send notifications and reminders you&apos;ve turned on (your consent, which you can withdraw any time).</li>
          <li>To manage subscriptions (agreement with you).</li>
          <li>To understand how the app is used and improve it, only with your consent.</li>
          <li>To keep the service secure and prevent abuse (our legitimate interest).</li>
        </ul>
      </section>

      <section>
        <h2>Who can see your data</h2>
        <p>
          <strong>Your household:</strong> members of your household can see your name, avatar, the chores you complete,
          your points, streaks, badges and rewards you redeem. Nobody outside your household can.
        </p>
        <p>
          <strong>Service providers</strong> process data on our behalf, under data processing agreements:
        </p>
        <ul>
          <li>Google Firebase: sign-in, database, notifications, server functions and optional analytics</li>
          <li>Vercel: hosting of the web version</li>
          <li>RevenueCat: subscription management</li>
          <li>Apple and Google: app stores, payments, Sign in with Apple / Google, and delivering notifications</li>
        </ul>
        <p>
          Some providers process data in the United States. Transfers rely on the EU-U.S. Data Privacy Framework or the
          European Commission&apos;s Standard Contractual Clauses. We don&apos;t sell or rent your data, and we don&apos;t
          use it for advertising.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep your data while you have an account. When you delete your account (Profile → Delete account), your
          sign-in, profile and device tokens are deleted. If you were the only member of your household, the household
          and all its chores and history are deleted too. If others are still in the household, the chores you completed
          stay in its shared history (linked to an anonymous user ID, without your name) so their scores stay correct.
          Remaining copies are removed from our systems within 30 days.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can access, correct, export or delete your data, object to or restrict its use, and withdraw consent at any
          time. Most of this you can do in the app (edit your profile, turn off notifications and statistics, delete your
          account). For anything else, email <ContactEmail />. You can also complain to your data protection authority;
          in Sweden that is {LEGAL.supervisoryAuthority}.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          ChoreQuest isn&apos;t directed at children under 13, and they shouldn&apos;t create an account. If you believe
          a child has given us personal data, contact us and we&apos;ll delete it.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is encrypted in transit, stored with Google Firebase, and protected by access rules so only members of a
          household can read its data.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If we change this policy we&apos;ll update the date above, and tell you in the app if the changes are
          significant.
        </p>
      </section>
    </LegalPage>
  );
}
