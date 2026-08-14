"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";

export default function NotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show banner if notifications are supported and not yet asked
    if (typeof window !== "undefined" && "Notification" in window) {
      // Delay showing to avoid blocking first render
      const timer = setTimeout(() => {
        if (Notification.permission === "default") {
          setVisible(true);
        }
      }, 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setVisible(false);
      }
    } catch (error) {
      console.error("Notification permission error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#FF6B35]/10 shrink-0">
                <Bell className="w-4 h-4 text-[#FF6B35]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/80">
                  Get deadline reminders
                </p>
              </div>
              <button
                onClick={handleEnable}
                disabled={loading}
                className="px-3 py-1 rounded-lg bg-[#FF6B35]/20 text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/30 transition-colors shrink-0 disabled:opacity-50"
              >
                {loading ? "..." : "Enable"}
              </button>
              <button
                onClick={() => setVisible(false)}
                className="text-white/30 hover:text-white/60 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
