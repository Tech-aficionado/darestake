"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User } from "@/lib/firestore-schema";
import { createOrUpdateUser, checkAndApplyPenalties, getTasksByPair } from "@/lib/firestore";
import { subscribeToUserDoc } from "@/lib/firestore-realtime";
import { checkAndSendWeeklySummary } from "@/lib/weekly-summary";

interface UserDataContextType {
  userData: User | null;
  partnerData: User | null;
  loading: boolean;
  refresh: () => void;
}

const UserDataContext = createContext<UserDataContextType>({
  userData: null,
  partnerData: null,
  loading: true,
  refresh: () => {},
});

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [partnerData, setPartnerData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const penaltyCheckedRef = useRef(false);
  const partnerUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to the current user's doc
  useEffect(() => {
    if (!user) {
      setUserData(null);
      setPartnerData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Upsert user on mount (fire-and-forget)
    createOrUpdateUser(user).catch(console.error);

    const unsub = subscribeToUserDoc(user.uid, (uData) => {
      setUserData(uData);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Subscribe to partner doc when userData.pairedWith changes
  useEffect(() => {
    // Clean up previous partner subscription
    if (partnerUnsubRef.current) {
      partnerUnsubRef.current();
      partnerUnsubRef.current = null;
    }

    if (!userData?.pairedWith || !userData.pairId) {
      setPartnerData(null);
      return;
    }

    const unsub = subscribeToUserDoc(userData.pairedWith, (pData) => {
      setPartnerData(pData);
    });
    partnerUnsubRef.current = unsub;

    // Check and apply penalties once per session
    if (!penaltyCheckedRef.current) {
      penaltyCheckedRef.current = true;
      checkAndApplyPenalties(userData.pairId).catch(console.error);

      // Fire-and-forget weekly summary (only sends on Sundays, deduped)
      getTasksByPair(userData.pairId, 50)
        .then((tasks) => {
          checkAndSendWeeklySummary(tasks, userData.uid, userData.displayName);
        })
        .catch(console.error);
    }

    return () => {
      if (partnerUnsubRef.current) {
        partnerUnsubRef.current();
        partnerUnsubRef.current = null;
      }
    };
  }, [userData?.pairedWith, userData?.pairId]);

  // Manual refresh — triggers re-read via subscription (mostly a no-op now,
  // but kept for imperative use cases like after completeTask)
  const refresh = useCallback(() => {
    // With real-time listeners the data auto-updates.
    // This forces a re-render tick for any local optimistic state.
    setUserData((prev) => (prev ? { ...prev } : null));
  }, []);

  return (
    <UserDataContext.Provider value={{ userData, partnerData, loading, refresh }}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  return useContext(UserDataContext);
}
