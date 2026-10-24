// Firestore security rules, tested against the emulator (`npm run test:rules`).
// Each test signs in as a user and checks what they may and may not do. The
// "app flows" block replays the writes the app itself makes, so a rules change
// can't silently lock real users out.
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  // Denied writes are expected in these tests; don't log each one
  setLogLevel("silent");
  env = await initializeTestEnvironment({
    projectId: "demo-chorequest",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

// Alice and Bob share household h1; Eve is signed in but not in any household.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", email: "a@x.se", name: "Alice", householdId: "h1", createdAt: 1, updatedAt: 1 });
    await setDoc(doc(db, "users/bob"), { uid: "bob", email: "b@x.se", name: "Bob", householdId: "h1", createdAt: 1, updatedAt: 1 });
    await setDoc(doc(db, "users/eve"), { uid: "eve", email: "e@x.se", name: "Eve", householdId: null, createdAt: 1, updatedAt: 1 });
    await setDoc(doc(db, "households/h1"), {
      id: "h1",
      name: "Home",
      code: "ABC234",
      members: { alice: true, bob: true },
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households/h1/choreTemplates/t1"), {
      title: "🧹 Sweep",
      points: 10,
      frequency: "daily",
      assigneeMode: "anyone",
      active: true,
      schedule: {},
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households/h1/redemptions/r-bob"), {
      rewardId: "x",
      title: "Movie",
      icon: "🎬",
      cost: 100,
      uid: "bob",
      status: "pending",
      createdAt: 1,
    });
  });
});

const as = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

const completion = (actorUid: string, delta = 10) => ({
  type: "complete",
  actorUid,
  delta,
  reason: "Completed: 🧹 Sweep",
  createdAt: Date.now(),
  templateId: "t1",
  dayKey: "2026-10-24",
});

describe("users", () => {
  it("lets you read your own profile and your household members'", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "users/alice")));
    await assertSucceeds(getDoc(doc(as("alice"), "users/bob")));
  });

  it("hides profiles of people outside your household", async () => {
    await assertFails(getDoc(doc(as("eve"), "users/alice")));
    await assertFails(getDoc(doc(anon(), "users/alice")));
  });

  it("only lets you create your own profile, without a household", async () => {
    await assertSucceeds(setDoc(doc(as("newbie"), "users/newbie"), { uid: "newbie", email: null, name: "", householdId: null, createdAt: 1, updatedAt: 1 }));
    await assertFails(setDoc(doc(as("mallory"), "users/mallory"), { uid: "mallory", name: "", householdId: "h1", createdAt: 1, updatedAt: 1 }));
    await assertFails(setDoc(doc(as("eve"), "users/someone"), { uid: "someone", name: "", householdId: null, createdAt: 1, updatedAt: 1 }));
  });

  it("only lets you point your profile at a household you belong to", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { name: "Ali", avatar: "🦊", updatedAt: 2 }));
    await assertFails(updateDoc(doc(as("eve"), "users/eve"), { householdId: "h1", updatedAt: 2 }));
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { householdId: null, updatedAt: 2 }));
    await assertFails(updateDoc(doc(as("alice"), "users/bob"), { name: "Bobby" }));
  });

  it("lets you delete only your own profile", async () => {
    await assertSucceeds(deleteDoc(doc(as("alice"), "users/alice")));
    await assertFails(deleteDoc(doc(as("alice"), "users/bob")));
  });

  it("keeps push tokens private to their owner", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice/pushTokens/tok1"), { token: "tok1", platform: "ios", updatedAt: 1 }));
    await assertFails(setDoc(doc(as("bob"), "users/alice/pushTokens/tok2"), { token: "tok2", platform: "ios", updatedAt: 1 }));
    await assertFails(getDoc(doc(as("bob"), "users/alice/pushTokens/tok1")));
  });
});

describe("households", () => {
  it("is visible to members only", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "households/h1")));
    await assertFails(getDoc(doc(as("eve"), "households/h1")));
  });

  it("can be created with yourself as the only member and no plan", async () => {
    await assertSucceeds(setDoc(doc(as("eve"), "households/h2"), { id: "h2", name: "Eve's", code: "EVE234", members: { eve: true }, createdAt: 1, updatedAt: 1 }));
    await assertFails(setDoc(doc(as("eve"), "households/h3"), { id: "h3", name: "X", code: "X", members: { eve: true, bob: true }, createdAt: 1, updatedAt: 1 }));
    await assertFails(setDoc(doc(as("eve"), "households/h4"), { id: "h4", name: "X", code: "X", members: { eve: true }, plan: { tier: "plus", expiresAt: null }, createdAt: 1, updatedAt: 1 }));
  });

  it("lets members rename it and leave, but not grant Plus or change others' membership", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "households/h1"), { name: "Casa", updatedAt: 2 }));
    await assertFails(updateDoc(doc(as("alice"), "households/h1"), { plan: { tier: "plus", expiresAt: null } }));
    await assertFails(updateDoc(doc(as("alice"), "households/h1"), { "members.eve": true }));
    await assertFails(updateDoc(doc(as("alice"), "households/h1"), { "members.bob": deleteField() }));
    await assertSucceeds(updateDoc(doc(as("alice"), "households/h1"), { "members.alice": deleteField(), updatedAt: 2 }));
  });

  it("lets a non-member add only themselves", async () => {
    await assertSucceeds(updateDoc(doc(as("eve"), "households/h1"), { "members.eve": true, updatedAt: 2 }));
  });

  it("doesn't let a non-member change anything else", async () => {
    await assertFails(updateDoc(doc(as("eve"), "households/h1"), { "members.eve": true, name: "Mine now" }));
    await assertFails(updateDoc(doc(as("eve"), "households/h1"), { "members.mallory": true }));
  });

  it("can't be deleted from the app", async () => {
    await assertFails(deleteDoc(doc(as("alice"), "households/h1")));
  });
});

describe("chores", () => {
  it("are readable and editable by members, with sane values", async () => {
    const db = as("alice");
    await assertSucceeds(getDoc(doc(db, "households/h1/choreTemplates/t1")));
    await assertSucceeds(addDoc(collection(db, "households/h1/choreTemplates"), { title: "🧺 Laundry", points: 30, frequency: "weekly", assigneeMode: "rotating", active: true, schedule: {}, createdAt: 1, updatedAt: 1 }));
    await assertFails(addDoc(collection(db, "households/h1/choreTemplates"), { title: "Cheat", points: 5000, frequency: "daily", assigneeMode: "anyone", active: true }));
    await assertSucceeds(updateDoc(doc(db, "households/h1/choreTemplates/t1"), { active: false, updatedAt: 2 }));
    await assertSucceeds(deleteDoc(doc(db, "households/h1/choreTemplates/t1")));
  });

  it("are hidden from non-members", async () => {
    await assertFails(getDoc(doc(as("eve"), "households/h1/choreTemplates/t1")));
  });
});

describe("ledger", () => {
  it("accepts points only for yourself, within range", async () => {
    const db = as("alice");
    await assertSucceeds(setDoc(doc(db, "households/h1/ledger/c1"), completion("alice")));
    await assertFails(setDoc(doc(db, "households/h1/ledger/c2"), completion("bob")));
    await assertFails(setDoc(doc(db, "households/h1/ledger/c3"), completion("alice", 1000)));
    await assertFails(setDoc(doc(as("eve"), "households/h1/ledger/c4"), completion("eve")));
  });

  it("is append-only", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "households/h1/ledger/c1"), completion("alice"));
    });
    await assertFails(updateDoc(doc(as("alice"), "households/h1/ledger/c1"), { delta: 60 }));
    await assertFails(deleteDoc(doc(as("alice"), "households/h1/ledger/c1")));
  });
});

describe("rewards", () => {
  it("can be managed by members with a sane price", async () => {
    const db = as("alice");
    await assertSucceeds(addDoc(collection(db, "households/h1/rewards"), { title: "Pick the movie", icon: "🎬", cost: 100, active: true, createdBy: "alice", createdAt: 1, updatedAt: 1 }));
    await assertFails(addDoc(collection(db, "households/h1/rewards"), { title: "Free", icon: "🎬", cost: 0 }));
    await assertFails(addDoc(collection(as("eve"), "households/h1/rewards"), { title: "X", icon: "🎬", cost: 10 }));
  });

  it("redemptions: for yourself, marked done by anyone, cancelled only by the redeemer", async () => {
    const db = as("alice");
    await assertSucceeds(addDoc(collection(db, "households/h1/redemptions"), { rewardId: "x", title: "Movie", icon: "🎬", cost: 100, uid: "alice", status: "pending", createdAt: 1 }));
    await assertFails(addDoc(collection(db, "households/h1/redemptions"), { rewardId: "x", title: "Movie", icon: "🎬", cost: 100, uid: "bob", status: "pending", createdAt: 1 }));
    await assertFails(updateDoc(doc(db, "households/h1/redemptions/r-bob"), { cost: 1 }));
    await assertFails(deleteDoc(doc(db, "households/h1/redemptions/r-bob")));
    await assertSucceeds(deleteDoc(doc(as("bob"), "households/h1/redemptions/r-bob")));
  });

  it("lets anyone in the household mark a redemption delivered", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "households/h1/redemptions/r-bob"), { status: "fulfilled", fulfilledBy: "alice", fulfilledAt: 2 }));
  });
});

// The writes the app makes, in the order it makes them
describe("app flows", () => {
  it("sign-up: create profile, then create a household and link it", async () => {
    const db = as("carol");
    await assertSucceeds(setDoc(doc(db, "users/carol"), { uid: "carol", email: "c@x.se", name: "", householdId: null, createdAt: 1, updatedAt: 1 }));
    await assertSucceeds(setDoc(doc(db, "households/hc"), { id: "hc", name: "Carol's", code: "CAR234", members: { carol: true }, createdAt: 1, updatedAt: 1 }));
    await assertSucceeds(updateDoc(doc(db, "users/carol"), { householdId: "hc", updatedAt: 2 }));
    await assertSucceeds(updateDoc(doc(db, "users/carol"), { name: "Carol", avatar: "🦊", updatedAt: 3 }));
  });

  it("join by code: find the household, add yourself, then link your profile", async () => {
    const db = as("eve");
    const found = await assertSucceeds(getDocs(query(collection(db, "households"), where("code", "==", "ABC234"))));
    const hid = found.docs[0].id;
    await assertSucceeds(updateDoc(doc(db, "households", hid), { "members.eve": true, updatedAt: 2 }));
    await assertSucceeds(updateDoc(doc(db, "users/eve"), { householdId: hid, updatedAt: 2 }));
    await assertSucceeds(getDoc(doc(db, "households/h1/choreTemplates/t1")));
  });

  it("complete a chore in a transaction (reads a document that doesn't exist yet)", async () => {
    const db = as("alice");
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const ref = doc(db, "households/h1/ledger/c__t1__2026-10-24__0");
        const snap = await tx.get(ref);
        if (!snap.exists()) tx.set(ref, completion("alice"));
      }),
    );
  });

  it("leave a household: remove membership, then unlink the profile", async () => {
    const db = as("bob");
    await assertSucceeds(updateDoc(doc(db, "households/h1"), { "members.bob": deleteField(), updatedAt: 2 }));
    await assertSucceeds(updateDoc(doc(db, "users/bob"), { householdId: null, updatedAt: 2 }));
  });
});
