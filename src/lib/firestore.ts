import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  increment,
  runTransaction,
} from "firebase/firestore";
import { User as FirebaseAuthUser } from "firebase/auth";
import { db } from "./firebase";
import {
  User,
  Pair,
  DailyTask,
  GoldJar,
  GoldJarEntry,
  Streak,
  fineRange,
  FINE_LIMIT_MIN,
  FINE_LIMIT_MAX,
} from "./firestore-schema";
import { todayIST, daysAgoIST } from "./ist";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// IST date math lives in ./ist -- see that file for why the old inline
// helpers (which added getTimezoneOffset on top of the IST offset) were wrong.
const getTodayIST = todayIST;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── 1. User Management ─────────────────────────────────────────────────────

export async function createOrUpdateUser(user: FirebaseAuthUser): Promise<User> {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  const userData: User = {
    uid: user.uid,
    displayName: user.displayName || "Anonymous",
    email: user.email || "",
    photoURL: user.photoURL,
    pairedWith: existing.exists() ? existing.data().pairedWith : null,
    pairId: existing.exists() ? existing.data().pairId : null,
    createdAt: existing.exists() ? existing.data().createdAt : Timestamp.now(),
    streak: existing.exists() ? existing.data().streak : 0,
    totalPenalties: existing.exists() ? existing.data().totalPenalties : 0,
    tasksCompleted: existing.exists() ? existing.data().tasksCompleted || 0 : 0,
  };

  await setDoc(userRef, userData, { merge: true });
  return userData;
}

export async function getUser(uid: string): Promise<User | null> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? (snap.data() as User) : null;
}

// NOTE: a getUserByEmail() helper used to live here. It was dead code (zero
// callers) and enumerated the users collection by email, which the Firestore
// rules now deny (`allow list: if false` on /users). Removed so the code and
// the rules can't drift. Look users up by UID.

// ─── 2. Pairing System ──────────────────────────────────────────────────────

export async function createPairInvite(fromUid: string): Promise<string> {
  const code = generateCode();
  const inviteRef = doc(db, "pairInvites", code);

  await setDoc(inviteRef, {
    code,
    fromUid,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    used: false,
  });

  return code;
}

export async function acceptPairInvite(
  code: string,
  accepterUid: string
): Promise<string> {
  const inviteRef = doc(db, "pairInvites", code);
  const pairRef = doc(collection(db, "pairs"));
  const pairId = pairRef.id;

  // Everything happens in ONE transaction. Previously this was a read followed
  // by separate writes, which let two people accept the same code
  // simultaneously (both passed the `used` check) and created orphaned pairs.
  await runTransaction(db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error("Invalid invite code");

    const invite = inviteSnap.data();
    if (invite.used) throw new Error("Invite already used");
    if (invite.expiresAt.toDate() < new Date()) {
      throw new Error("Invite expired");
    }
    if (invite.fromUid === accepterUid) {
      throw new Error("Cannot pair with yourself");
    }

    const inviterRef = doc(db, "users", invite.fromUid);
    const accepterRef = doc(db, "users", accepterUid);
    const inviterSnap = await tx.get(inviterRef);
    const accepterSnap = await tx.get(accepterRef);

    if (!inviterSnap.exists()) throw new Error("Inviter account not found");
    if (!accepterSnap.exists()) throw new Error("Your account was not found");

    // Refuse if either side is already paired. Without this the old code
    // silently overwrote pairedWith/pairId, leaving the abandoned partner
    // pointing at a pair whose other member had moved on -- asymmetric state
    // where their tasks and jar silently detached.
    const inviter = inviterSnap.data() as User;
    const accepter = accepterSnap.data() as User;
    if (inviter.pairedWith) {
      throw new Error("That person is already paired with someone else.");
    }
    if (accepter.pairedWith) {
      throw new Error("You're already paired. Unpair first to switch partners.");
    }

    const pair: Pair = {
      id: pairId,
      members: [invite.fromUid, accepterUid],
      createdAt: Timestamp.now(),
      isActive: true,
    };

    tx.set(pairRef, pair);
    tx.update(inviterRef, { pairedWith: accepterUid, pairId });
    tx.update(accepterRef, { pairedWith: invite.fromUid, pairId });
    // Consume the invite atomically with the pairing.
    tx.delete(inviteRef);
  });

  return pairId;
}

export async function getPair(pairId: string): Promise<Pair | null> {
  const pairRef = doc(db, "pairs", pairId);
  const snap = await getDoc(pairRef);
  return snap.exists() ? (snap.data() as Pair) : null;
}

/**
 * Set the pair's maximum fine. Stored on the pair rather than the user because
 * the stakes are a shared agreement and the jar is shared -- both partners must
 * see the same number, and either may change it.
 */
export async function updateMaxFine(
  pairId: string,
  uid: string,
  maxFine: number
): Promise<void> {
  if (!Number.isFinite(maxFine)) {
    throw new Error("Enter a number.");
  }
  const value = Math.floor(maxFine);
  if (value < FINE_LIMIT_MIN || value > FINE_LIMIT_MAX) {
    throw new Error(
      `Pick a max fine between ₹${FINE_LIMIT_MIN} and ₹${FINE_LIMIT_MAX.toLocaleString("en-IN")}.`
    );
  }

  const pairRef = doc(db, "pairs", pairId);

  // Membership-checked in a transaction, matching how unpair works: the
  // Firestore rules already require membership, but failing here gives a real
  // message instead of an opaque permission error.
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(pairRef);
    if (!snap.exists()) throw new Error("Pair not found");
    const pair = snap.data() as Pair;
    if (!pair.members.includes(uid)) {
      throw new Error("You are not a member of this pair.");
    }
    tx.update(pairRef, { maxFine: value });
  });
}

export async function unpair(pairId: string, uid: string): Promise<void> {
  const pairRef = doc(db, "pairs", pairId);

  // Atomic, and membership-checked. The old version did three sequential
  // writes, so a failure partway left one user unpaired and the other still
  // pointing at the dead pair -- and it never verified the caller was actually
  // in the pair.
  await runTransaction(db, async (tx) => {
    const pairSnap = await tx.get(pairRef);
    if (!pairSnap.exists()) throw new Error("Pair not found");

    const pair = pairSnap.data() as Pair;
    if (!pair.members.includes(uid)) {
      throw new Error("You are not a member of this pair.");
    }

    tx.update(pairRef, { isActive: false });
    for (const memberUid of pair.members) {
      tx.update(doc(db, "users", memberUid), {
        pairedWith: null,
        pairId: null,
      });
    }
  });
}

// ─── 3. Tasks ────────────────────────────────────────────────────────────────

/**
 * Create a dare.
 *
 * Uses a DETERMINISTIC document id -- `${pairId}_${assignedTo}_${date}` -- so
 * "one dare per person per day" is enforced structurally by the datastore
 * rather than by a client-side check. The old version used addDoc(), which
 * meant two tabs, a double-tap that outran the disabled state, or a retry
 * after a network timeout that had actually succeeded, each silently inserted
 * a SECOND task for the same day -- and the penalty engine would then fine the
 * assignee twice for it.
 *
 * A client-side transaction can't run queries (only tx.get on a known ref), so
 * a query-based guard could never be atomic. Encoding the constraint in the id
 * is what makes this race-safe.
 */
export async function createTask(
  task: Omit<DailyTask, "id" | "createdAt">
): Promise<DailyTask> {
  const taskId = `${task.pairId}_${task.assignedTo}_${task.date}`;
  const taskRef = doc(db, "tasks", taskId);

  const taskData = {
    ...task,
    createdAt: Timestamp.now(),
  };

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(taskRef);
    if (existing.exists()) {
      throw new Error("A dare already exists for this person today.");
    }
    tx.set(taskRef, taskData);
  });

  return {
    id: taskId,
    ...taskData,
  };
}

export async function getTodayTask(
  pairId: string,
  assignedTo: string
): Promise<DailyTask | null> {
  const today = getTodayIST();
  const q = query(
    collection(db, "tasks"),
    where("pairId", "==", pairId),
    where("assignedTo", "==", assignedTo),
    where("date", "==", today)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as DailyTask;
}

export async function getTasksByPair(
  pairId: string,
  limit: number = 20
): Promise<DailyTask[]> {
  const q = query(
    collection(db, "tasks"),
    where("pairId", "==", pairId),
    orderBy("date", "desc"),
    firestoreLimit(limit)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
}

export async function completeTask(
  taskId: string,
  proofPhotoId?: string,
  proofPhotoUrl?: string
): Promise<void> {
  const taskRef = doc(db, "tasks", taskId);
  const taskSnap = await getDoc(taskRef);

  const updateData: Record<string, unknown> = {
    isCompleted: true,
    completedAt: Timestamp.now(),
  };

  if (proofPhotoId) updateData.proofPhotoId = proofPhotoId;
  if (proofPhotoUrl) updateData.proofPhotoUrl = proofPhotoUrl;

  if (!taskSnap.exists()) return;
  const taskData = taskSnap.data() as DailyTask;

  // Idempotency guard: a double-tap previously double-incremented
  // tasksCompleted and double-advanced the streak.
  if (taskData.isCompleted) return;

  await updateDoc(taskRef, updateData);

  // Increment tasksCompleted counter for the user
  await updateDoc(doc(db, "users", taskData.assignedTo), {
    tasksCompleted: increment(1),
  });

  // Advance the streak. This call was missing entirely, so updateStreak was
  // dead code and users.streak stayed 0 forever -- every streak display in the
  // app (badge, dashboard stat, insights comparison) was permanently zero.
  try {
    await updateStreak(taskData.assignedTo, taskData.pairId, taskData.date);
  } catch (error) {
    // Never let a streak bookkeeping failure block task completion.
    console.error("Failed to update streak:", error);
  }
}

export async function getPartnerTodayTask(
  pairId: string,
  partnerUid: string
): Promise<DailyTask | null> {
  return getTodayTask(pairId, partnerUid);
}

// ─── Witness Mode (Dispute) ──────────────────────────────────────────────────

export async function disputeTask(
  taskId: string,
  disputedBy: string
): Promise<void> {
  const taskRef = doc(db, "tasks", taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) throw new Error("Task not found");

  const task = snap.data() as DailyTask;

  // Guards the old version lacked entirely: you could dispute a task that was
  // never completed, dispute your OWN completion, or re-open a dispute that had
  // already been settled with proof.
  if (!task.isCompleted) {
    throw new Error("Only a completed dare can be disputed.");
  }
  if (task.assignedTo === disputedBy) {
    throw new Error("You can't dispute your own completion.");
  }
  if (task.disputed && !task.disputeResolved) {
    throw new Error("This dare is already under dispute.");
  }
  if (task.disputeResolved) {
    throw new Error("This dispute was already settled with proof.");
  }

  await updateDoc(taskRef, {
    disputed: true,
    disputedBy,
    disputedAt: Timestamp.now(),
    disputeResolved: false,
  });
}

/**
 * Settle a dispute. Requires photo proof to actually be attached -- the old
 * version flipped disputeResolved unconditionally, so a caller could clear a
 * dispute without ever providing the proof the dispute was demanding.
 */
export async function resolveDispute(taskId: string): Promise<void> {
  const taskRef = doc(db, "tasks", taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) throw new Error("Task not found");

  const task = snap.data() as DailyTask;
  if (!task.proofPhotoId && !task.proofPhotoUrl) {
    throw new Error("Upload photo proof before resolving the dispute.");
  }

  await updateDoc(taskRef, {
    disputeResolved: true,
  });
}

// ─── 4. Gold Jar ─────────────────────────────────────────────────────────────

export async function getOrCreateJar(pairId: string): Promise<GoldJar> {
  const jarRef = doc(db, "goldJars", pairId);
  const snap = await getDoc(jarRef);

  if (snap.exists()) {
    return snap.data() as GoldJar;
  }

  const jar: GoldJar = {
    id: pairId,
    pairId,
    totalAmount: 0,
    entryCount: 0,
    lastUpdated: Timestamp.now(),
  };

  await setDoc(jarRef, jar);
  return jar;
}

export async function addPenalty(
  entry: Omit<GoldJarEntry, "id" | "createdAt">
): Promise<GoldJarEntry> {
  // Create entry
  const entryData = {
    ...entry,
    createdAt: Timestamp.now(),
  };

  const entryRef = await addDoc(collection(db, "goldJarEntries"), entryData);

  // Update jar totals
  const jarRef = doc(db, "goldJars", entry.pairId);
  await updateDoc(jarRef, {
    totalAmount: increment(entry.amount),
    entryCount: increment(1),
    lastUpdated: Timestamp.now(),
  });

  // Update user's total penalties
  const userRef = doc(db, "users", entry.userId);
  await updateDoc(userRef, {
    totalPenalties: increment(entry.amount),
  });

  return { id: entryRef.id, ...entryData };
}

export async function getJarEntries(
  pairId: string,
  limit: number = 20
): Promise<GoldJarEntry[]> {
  const q = query(
    collection(db, "goldJarEntries"),
    where("pairId", "==", pairId),
    orderBy("createdAt", "desc"),
    firestoreLimit(limit)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldJarEntry));
}

// ─── 5. Streaks ──────────────────────────────────────────────────────────────

export async function updateStreak(
  userId: string,
  pairId: string,
  completedDate: string
): Promise<Streak> {
  const streakId = `${userId}_${pairId}`;
  const streakRef = doc(db, "streaks", streakId);
  const snap = await getDoc(streakRef);

  let streak: Streak;

  if (!snap.exists()) {
    streak = {
      userId,
      pairId,
      currentStreak: 1,
      longestStreak: 1,
      lastCompletedDate: completedDate,
      updatedAt: Timestamp.now(),
    };
  } else {
    const existing = snap.data() as Streak;
    const lastDate = new Date(existing.lastCompletedDate);
    const currentDate = new Date(completedDate);
    const diffDays = Math.round(
      (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      // Consecutive day — increment
      const newStreak = existing.currentStreak + 1;
      streak = {
        ...existing,
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, existing.longestStreak),
        lastCompletedDate: completedDate,
        updatedAt: Timestamp.now(),
      };
    } else if (diffDays === 0) {
      // Same day — no change
      streak = existing;
    } else if (diffDays < 0) {
      // Backdated completion (an older task finished late). Do NOT reset the
      // streak and do NOT move lastCompletedDate backwards -- the old code fell
      // into the reset branch here and wiped a healthy streak.
      streak = existing;
    } else {
      // Gap — reset
      streak = {
        ...existing,
        currentStreak: 1,
        lastCompletedDate: completedDate,
        updatedAt: Timestamp.now(),
      };
    }
  }

  await setDoc(streakRef, streak);

  // Also update user's streak field
  await updateDoc(doc(db, "users", userId), { streak: streak.currentStreak });

  return streak;
}

export async function getStreak(
  userId: string,
  pairId: string
): Promise<Streak | null> {
  const streakId = `${userId}_${pairId}`;
  const streakRef = doc(db, "streaks", streakId);
  const snap = await getDoc(streakRef);
  return snap.exists() ? (snap.data() as Streak) : null;
}

/**
 * Break a user's streak after a missed dare. Preserves longestStreak so the
 * personal best survives, and mirrors the reset onto users.streak.
 */
export async function breakStreak(
  userId: string,
  pairId: string
): Promise<void> {
  const streakId = `${userId}_${pairId}`;
  const streakRef = doc(db, "streaks", streakId);
  const snap = await getDoc(streakRef);

  if (snap.exists()) {
    const existing = snap.data() as Streak;
    if (existing.currentStreak === 0) return; // already broken
    await setDoc(streakRef, {
      ...existing,
      currentStreak: 0,
      updatedAt: Timestamp.now(),
    });
  }

  await updateDoc(doc(db, "users", userId), { streak: 0 });
}

// ─── 6. Penalty Check ────────────────────────────────────────────────────────

/** How many past days to sweep for unpenalized misses. */
const PENALTY_LOOKBACK_DAYS = 14;

export async function checkAndApplyPenalties(pairId: string): Promise<number> {
  const today = getTodayIST();
  const windowStart = daysAgoIST(PENALTY_LOOKBACK_DAYS);

  // Sweep a WINDOW of past days, not just yesterday. The old query used
  // `date == yesterday`, so if nobody opened the app for a few days those
  // misses kept penaltyApplied: false forever and were never charged.
  // Range on `date` + equality on the rest matches the deployed composite index
  // (pairId, penaltyApplied, isCompleted, date).
  const q = query(
    collection(db, "tasks"),
    where("pairId", "==", pairId),
    where("penaltyApplied", "==", false),
    where("isCompleted", "==", false),
    where("date", ">=", windowStart),
    where("date", "<", today)
  );

  const snap = await getDocs(q);
  if (snap.empty) return 0;

  let penaltiesApplied = 0;

  // Ensure jar exists
  await getOrCreateJar(pairId);

  // Read the pair's configured stake once, outside the loop, rather than per
  // missed task -- the value can't change mid-sweep in any way that matters.
  const pairSnap = await getDoc(doc(db, "pairs", pairId));
  const { min: minFine, max: maxFine } = fineRange(
    pairSnap.exists() ? (pairSnap.data() as Pair).maxFine : undefined
  );

  for (const taskDoc of snap.docs) {
    const task = { id: taskDoc.id, ...taskDoc.data() } as DailyTask;
    const taskRef = doc(db, "tasks", task.id);

    // Atomically CLAIM the task before charging for it. Both partners' clients
    // run this sweep on load; without the transaction they could both read
    // penaltyApplied: false and charge the jar twice for one missed dare.
    let claimed = false;
    try {
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(taskRef);
        if (!fresh.exists()) return;
        const data = fresh.data() as DailyTask;
        // Someone else already claimed it, or it got completed in the meantime.
        if (data.penaltyApplied || data.isCompleted) return;
        tx.update(taskRef, { penaltyApplied: true });
        claimed = true;
      });
    } catch (error) {
      console.error("Failed to claim task for penalty:", task.id, error);
      continue;
    }

    if (!claimed) continue;

    // Random penalty within the pair's configured range (inclusive).
    const amount =
      Math.floor(Math.random() * (maxFine - minFine + 1)) + minFine;

    // A miss breaks the streak. Previously nothing reset it on a miss -- the
    // streak only ever changed on completion, so a user who missed days kept
    // displaying a stale streak that no longer reflected reality.
    try {
      await breakStreak(task.assignedTo, pairId);
    } catch (error) {
      console.error("Failed to break streak for", task.assignedTo, error);
    }

    await addPenalty({
      jarId: pairId,
      pairId,
      userId: task.assignedTo,
      amount,
      reason: `Missed: ${task.title}`,
      taskId: task.id,
      date: task.date,
    });

    penaltiesApplied++;
  }

  return penaltiesApplied;
}


// ─── 7. Reactions ────────────────────────────────────────────────────────────

export async function addReaction(
  taskId: string,
  emoji: string,
  uid: string
): Promise<void> {
  const taskRef = doc(db, "tasks", taskId);
  await updateDoc(taskRef, {
    [`reactions.${emoji}`]: uid,
  });
}

export async function removeReaction(
  taskId: string,
  emoji: string
): Promise<void> {
  const taskRef = doc(db, "tasks", taskId);
  const { deleteField } = await import("firebase/firestore");
  await updateDoc(taskRef, {
    [`reactions.${emoji}`]: deleteField(),
  });
}
