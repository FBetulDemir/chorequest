// ChoreQuest Cloud Functions: push notifications.
// NOT DEPLOYED YET. See docs/MOBILE.md ("Push notifications") before deploying.
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as functionsV1 from "firebase-functions/v1";

import { isCompletion, weeklyPoints } from "./scoring";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });

const db = getFirestore();

type Notice = { title: string; body: string; path: string };

/** Household member UIDs (members map entries set to true). */
async function memberUids(householdId: string): Promise<string[]> {
  const snap = await db.doc(`households/${householdId}`).get();
  const members = (snap.get("members") ?? {}) as Record<string, boolean>;
  return Object.keys(members).filter((uid) => members[uid] === true);
}

async function displayName(uid: string): Promise<string> {
  const snap = await db.doc(`users/${uid}`).get();
  const name = String(snap.get("name") ?? "").trim();
  return name || "Someone";
}

/** Sends a notification to every registered device of the given users and prunes dead tokens. */
async function notify(uids: string[], notice: Notice): Promise<void> {
  const tokenDocs = (
    await Promise.all(uids.map((uid) => db.collection(`users/${uid}/pushTokens`).get()))
  ).flatMap((s) => s.docs);
  if (!tokenDocs.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens: tokenDocs.map((d) => d.id),
    notification: { title: notice.title, body: notice.body },
    data: { path: notice.path },
    apns: { payload: { aps: { sound: "default" } } },
    android: { priority: "high", notification: { sound: "default" } },
  });

  const dead = res.responses
    .map((r, i) => ({ r, ref: tokenDocs[i].ref }))
    .filter(
      ({ r }) =>
        !r.success &&
        ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(
          r.error?.code ?? "",
        ),
    );
  await Promise.all(dead.map(({ ref }) => ref.delete()));
  logger.info("Sent notification", { sent: res.successCount, failed: res.failureCount, pruned: dead.length });
}

/** "Betül completed 🍽️ Do Dishes" to everyone else in the household. */
export const notifyChoreCompleted = onDocumentCreated("households/{householdId}/ledger/{entryId}", async (event) => {
  const entry = event.data?.data();
  if (!entry || !isCompletion(entry)) return;

  const actorUid = String(entry.actorUid ?? "");
  const others = (await memberUids(event.params.householdId)).filter((uid) => uid !== actorUid);
  if (!others.length) return;

  const chore = String(entry.reason ?? "").replace(/^Completed:\s*/, "");
  await notify(others, {
    title: `${await displayName(actorUid)} completed ${chore}`,
    body: `+${Number(entry.delta ?? 0)} points. Your turn to shine ✨`,
    path: "/today",
  });
});

/** Sunday evening: announce each household's winner of the week. */
export const announceWeeklyWinner = onSchedule(
  { schedule: "0 20 * * 0", timeZone: "Europe/Stockholm" },
  async () => {
    // Monday 00:00 → Sunday 20:00 local, i.e. the last 6 days and 20 hours
    const since = Date.now() - (6 * 24 + 20) * 3_600_000;
    const households = await db.collection("households").get();

    for (const h of households.docs) {
      const ledger = await db
        .collection(`households/${h.id}/ledger`)
        .where("createdAt", ">=", since - 14 * 86_400_000) // earlier completions can be undone this week
        .get();
      const points = weeklyPoints(ledger.docs.map((d) => ({ id: d.id, ...d.data() })), since);
      const ranked = [...points.entries()].sort((a, b) => b[1] - a[1]);
      if (!ranked.length || ranked[0][1] <= 0) continue;

      const members = await memberUids(h.id);
      const tie = ranked.length > 1 && ranked[1][1] === ranked[0][1];
      const winner = await displayName(ranked[0][0]);

      await notify(members, {
        title: tie ? "🤝 It’s a tie this week!" : `🏆 ${winner} won the week!`,
        body: tie
          ? `Both finished on ${ranked[0][1]} points. A new week starts tomorrow.`
          : `${ranked[0][1]} points. Can anyone beat that next week?`,
        path: "/score",
      });
    }
  },
);

/**
 * After an account is deleted: remove the profile (and its push tokens), take the
 * user out of any household, and delete households nobody is left in.
 * The app already removes what it can; this catches the rest with admin rights.
 */
export const cleanupDeletedUser = functionsV1
  .region("europe-west1")
  .auth.user()
  .onDelete(async (user) => {
    const uid = user.uid;

    const households = await db.collection("households").where(`members.${uid}`, "==", true).get();
    for (const h of households.docs) {
      const members = (h.get("members") ?? {}) as Record<string, boolean>;
      const others = Object.keys(members).filter((m) => m !== uid && members[m] === true);
      if (others.length === 0) {
        await db.recursiveDelete(h.ref); // chores, ledger and the household itself
        logger.info("Deleted household of removed account", { householdId: h.id });
      } else {
        await h.ref.update({ [`members.${uid}`]: FieldValue.delete(), updatedAt: Date.now() });
      }
    }

    await db.recursiveDelete(db.doc(`users/${uid}`));
    logger.info("Cleaned up deleted account", { uid, households: households.size });
  });

// ---------- Subscriptions (RevenueCat) ----------

/** Shared secret RevenueCat sends in the Authorization header (set in the RevenueCat dashboard). */
const revenuecatWebhookAuth = defineSecret("REVENUECAT_WEBHOOK_AUTH");

const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  // Still paid up until the period ends:
  "CANCELLATION",
  "BILLING_ISSUE",
]);

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  expiration_at_ms?: number | null;
  product_id?: string;
  store?: string;
  entitlement_ids?: string[] | null;
};

/**
 * Keeps households/{id}.plan in sync with the purchaser's subscription.
 * The app logs in to RevenueCat with the Firebase UID, so app_user_id is the UID.
 */
export const revenuecatWebhook = onRequest({ secrets: [revenuecatWebhookAuth] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  if (req.get("Authorization") !== revenuecatWebhookAuth.value()) {
    res.status(401).send("Unauthorized");
    return;
  }

  const event = (req.body?.event ?? {}) as RevenueCatEvent;
  const uid = event.app_user_id || event.original_app_user_id;
  const forPlus = !event.entitlement_ids || event.entitlement_ids.includes("plus");
  if (!uid || !event.type || event.type === "TEST" || !forPlus) {
    res.status(200).send("Ignored");
    return;
  }

  const householdId = (await db.doc(`users/${uid}`).get()).get("householdId") as string | undefined;
  if (!householdId) {
    logger.warn("Subscription event for user without household", { uid, type: event.type });
    res.status(200).send("No household");
    return;
  }
  const ref = db.doc(`households/${householdId}`);

  if (ACTIVE_EVENTS.has(event.type)) {
    await ref.update({
      plan: {
        tier: "plus",
        expiresAt: event.expiration_at_ms ?? null,
        store: event.store ?? null,
        productId: event.product_id ?? null,
        purchaserUid: uid,
        updatedAt: Date.now(),
      },
    });
  } else if (event.type === "EXPIRATION") {
    // Only clear the plan this purchaser paid for (another member may have their own)
    const current = (await ref.get()).get("plan") as { purchaserUid?: string } | null;
    if (!current || current.purchaserUid === uid) await ref.update({ plan: null });
  }

  logger.info("Subscription event", { uid, householdId, type: event.type });
  res.status(200).send("OK");
});
