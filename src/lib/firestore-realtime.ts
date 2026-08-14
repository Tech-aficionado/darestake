import {
  onSnapshot,
  doc,
  query,
  where,
  collection,
  orderBy,
  limit as firestoreLimit,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { User, DailyTask, GoldJar, GoldJarEntry } from "./firestore-schema";
import { todayIST } from "./ist";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// IST date math lives in ./ist (the old inline helper double-corrected for the
// browser's timezone offset and returned the UTC date instead of the IST date).
const getTodayIST = todayIST;

// ─── Real-time Subscriptions ─────────────────────────────────────────────────

/**
 * Subscribe to a user document. Fires callback on every change.
 */
export function subscribeToUserDoc(
  uid: string,
  callback: (user: User | null) => void
): Unsubscribe {
  const userRef = doc(db, "users", uid);
  return onSnapshot(
    userRef,
    (snap) => {
      callback(snap.exists() ? (snap.data() as User) : null);
    },
    (error) => {
      console.error("subscribeToUserDoc error:", error);
      callback(null);
    }
  );
}

/**
 * Subscribe to today's task for a specific user in a pair.
 */
export function subscribeToTodayTask(
  pairId: string,
  assignedTo: string,
  callback: (task: DailyTask | null) => void
): Unsubscribe {
  const today = getTodayIST();
  const q = query(
    collection(db, "tasks"),
    where("pairId", "==", pairId),
    where("assignedTo", "==", assignedTo),
    where("date", "==", today)
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        const docSnap = snap.docs[0];
        callback({ id: docSnap.id, ...docSnap.data() } as DailyTask);
      }
    },
    (error) => {
      console.error("subscribeToTodayTask error:", error);
      callback(null);
    }
  );
}

/**
 * Subscribe to the gold jar document for a pair.
 */
export function subscribeToJar(
  pairId: string,
  callback: (jar: GoldJar | null) => void
): Unsubscribe {
  const jarRef = doc(db, "goldJars", pairId);
  return onSnapshot(
    jarRef,
    (snap) => {
      callback(snap.exists() ? (snap.data() as GoldJar) : null);
    },
    (error) => {
      console.error("subscribeToJar error:", error);
      callback(null);
    }
  );
}

/**
 * Subscribe to gold jar entries for a pair (recent penalties).
 */
export function subscribeToJarEntries(
  pairId: string,
  entryLimit: number,
  callback: (entries: GoldJarEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "goldJarEntries"),
    where("pairId", "==", pairId),
    orderBy("createdAt", "desc"),
    firestoreLimit(entryLimit)
  );

  return onSnapshot(
    q,
    (snap) => {
      const entries = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as GoldJarEntry)
      );
      callback(entries);
    },
    (error) => {
      console.error("subscribeToJarEntries error:", error);
      callback([]);
    }
  );
}

/**
 * Subscribe to recent tasks for a pair (task history).
 */
export function subscribeToRecentTasks(
  pairId: string,
  taskLimit: number,
  callback: (tasks: DailyTask[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "tasks"),
    where("pairId", "==", pairId),
    orderBy("date", "desc"),
    firestoreLimit(taskLimit)
  );

  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as DailyTask)
      );
      callback(tasks);
    },
    (error) => {
      console.error("subscribeToRecentTasks error:", error);
      callback([]);
    }
  );
}
