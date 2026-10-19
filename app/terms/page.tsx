import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/src/components/LegalPage";
import { LEGAL } from "@/src/lib/legal";

export const metadata: Metadata = { title: "Terms of Use · ChoreQuest" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={`These terms apply when you use ${LEGAL.appName} on the web or in the iOS and Android apps. By creating an account you agree to them.`}>
      <section>
        <h2>Your account</h2>
        <p>
          You need to be at least 13 to create an account. Keep your sign-in details safe; you&apos;re responsible for
          what happens in your account. You can delete it any time in Profile → Delete account.
        </p>
      </section>

      <section>
        <h2>Households and content</h2>
        <p>
          Anyone with your household&apos;s invite code can ask to join it, so share it only with people you live with.
          Members can see and edit the household&apos;s chores and rewards. You keep ownership of what you add and let us
          store and show it to your household so the app works. Don&apos;t use ChoreQuest for anything unlawful,
          harmful or abusive.
        </p>
      </section>

      <section>
        <h2>ChoreQuest Plus</h2>
        <ul>
          <li>Plus is an optional subscription bought in the iOS or Android app. It covers your whole household.</li>
          <li>
            Payment is charged to your Apple ID or Google Play account when you confirm the purchase. If a free trial is
            offered, you&apos;re charged when it ends unless you cancel before then.
          </li>
          <li>
            The subscription renews automatically for the same period and price unless it&apos;s cancelled at least 24
            hours before the end of the current period.
          </li>
          <li>
            Manage or cancel the subscription in your App Store or Google Play account settings. Deleting the app or your
            account doesn&apos;t cancel it.
          </li>
          <li>Refunds are handled by Apple or Google under their policies.</li>
          <li>
            If you leave a household, its Plus subscription stays with the household. A new household needs its own.
          </li>
        </ul>
      </section>

      <section>
        <h2>App stores</h2>
        <p>
          If you downloaded the app from the Apple App Store, Apple&apos;s{" "}
          <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer">
            Licensed Application End User License Agreement
          </a>{" "}
          also applies. Apple and Google aren&apos;t responsible for the app or its support.
        </p>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          We work hard to keep ChoreQuest running and your data safe, but the service is provided &quot;as is&quot;. We
          may change or discontinue features, and we&apos;ll give reasonable notice of significant changes. As far as the
          law allows, we aren&apos;t liable for indirect losses or for disagreements about whose turn it was to do the
          dishes. Nothing in these terms limits your rights as a consumer under mandatory law.
        </p>
      </section>

      <section>
        <h2>Ending</h2>
        <p>
          You can stop using ChoreQuest and delete your account at any time. We may suspend accounts that seriously or
          repeatedly break these terms.
        </p>
      </section>

      <section>
        <h2>Law and contact</h2>
        <p>
          These terms are governed by the laws of {LEGAL.country}. Questions? Email <ContactEmail />. See also our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
