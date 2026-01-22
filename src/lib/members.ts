import { db } from "@/src/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getUserProfile } from "@/src/lib/profile";

export type HouseholdMember = {
  uid: string;
  name: string;
};

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const col = collection(db, "households", householdId, "members");
  const snap = await getDocs(col);

  const out: HouseholdMember[] = [];

  for (const docSnap of snap.docs) {
    const d = docSnap.data() as any;
    const uid = (d.uid as string) ?? docSnap.id;

    try {
      const p = await getUserProfile(uid);
      out.push({ uid, name: p?.name ?? uid.slice(0, 6) });
    } catch {
      out.push({ uid, name: uid.slice(0, 6) });
    }
  }

  // Optional: sort by name for nicer UI
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
