import { get, push, ref, runTransaction, set } from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type CompletedSessionRecord = {
  date: string;
  duration: number;
  completedPomos: number;
  pomoDuration: string;
  totalPomos: number;
};

type UserStats = {
  totalSessions: number;
  totalPomos: number;
  totalMinutes: number;
};

export async function recordCompletedSession(
  uid: string,
  record: CompletedSessionRecord,
): Promise<void> {
  const db = getFirebaseDatabase();

  try {
    const entryRef = push(ref(db, `users/${uid}/completedSessions`));
    await set(entryRef, record);

    const statsRef = ref(db, `users/${uid}/stats`);
    await runTransaction(statsRef, (current: UserStats | null) => {
      const base: UserStats = current ?? {
        totalSessions: 0,
        totalPomos: 0,
        totalMinutes: 0,
      };
      return {
        totalSessions: base.totalSessions + 1,
        totalPomos: base.totalPomos + record.completedPomos,
        totalMinutes: base.totalMinutes + record.duration,
      };
    });
  } catch (error) {
    console.error("Failed to record completed session:", error);
  }
}

export async function loadCompletedSessions(uid: string) {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `users/${uid}/completedSessions`));
  const raw = (snap.val() ?? {}) as Record<string, CompletedSessionRecord>;
  return Object.entries(raw).map(([id, value]) => ({ id, ...value }));
}
