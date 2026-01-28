import { db } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getUserProfile } from "@/src/lib/profile";

export type HouseholdMember = {
  uid: string;
  name: string;
};

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const ref = doc(db, "households", householdId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return [];

  const data = snap.data() as any;
  const membersMap = (data.members ?? {}) as Record<string, boolean>;
  const uids = Object.keys(membersMap).filter(
    (uid) => membersMap[uid] === true,
  );

  const out: HouseholdMember[] = [];

  for (const uid of uids) {
    try {
      const p = await getUserProfile(uid);
      const finalName = p?.name?.trim() ? p.name : uid.slice(0, 6);
      out.push({ uid, name: finalName });
    } catch (err) {
      out.push({ uid, name: uid.slice(0, 6) });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
