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
  const hhRef = doc(db, "households", householdId);
  const hhSnap = await getDoc(hhRef);
  if (!hhSnap.exists()) return [];

  const data = hhSnap.data() as any;
  const membersObj = (data.members ?? {}) as Record<string, boolean>;
  const uids = Object.keys(membersObj).filter(
    (uid) => membersObj[uid] === true,
  );

  const out: HouseholdMember[] = [];
  for (const uid of uids) {
    try {
      const p = await getUserProfile(uid);
      out.push({ uid, name: p?.name ?? uid.slice(0, 6) });
    } catch {
      out.push({ uid, name: uid.slice(0, 6) });
    }
  }
  return out;
}
