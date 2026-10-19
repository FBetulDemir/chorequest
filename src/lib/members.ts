import { db } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getUserProfile } from "@/src/lib/profile";

export type HouseholdMember = {
  uid: string;
  name: string;
  avatar?: string | null;
};

/** UIDs marked as members in a household's `members` map. */
export function memberUids(membersMap: Record<string, boolean>): string[] {
  return Object.keys(membersMap ?? {})
    .filter((uid) => membersMap[uid] === true)
    .sort();
}

/** Loads display names for the given UIDs, in parallel, sorted by name. */
export async function loadMembers(uids: string[]): Promise<HouseholdMember[]> {
  const out = await Promise.all(
    uids.map(async (uid) => {
      try {
        const p = await getUserProfile(uid);
        return {
          uid,
          name: p?.name?.trim() ? p.name : uid.slice(0, 6),
          avatar: p?.avatar ?? null,
        };
      } catch {
        return { uid, name: uid.slice(0, 6) };
      }
    }),
  );
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const snap = await getDoc(doc(db, "households", householdId));
  if (!snap.exists()) return [];
  return loadMembers(memberUids(snap.data().members ?? {}));
}
