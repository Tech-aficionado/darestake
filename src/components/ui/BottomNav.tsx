"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Send, Coins, BarChart3, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Send, label: "Dare", path: "/assign" },
  { icon: Coins, label: "Jar", path: "/jar" },
  { icon: BarChart3, label: "Insights", path: "/insights" },
  { icon: User, label: "Me", path: "/profile" },
];

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Fade gradient above nav */}
      <div className="fixed bottom-[72px] left-0 right-0 h-16 z-40 pointer-events-none bg-gradient-to-t from-[#0D0D0D] to-transparent" />

      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
      >
        <div className="mx-2 mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-2xl shadow-black/60 overflow-hidden">
          <div className="flex items-center justify-evenly py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;

              return (
                <motion.button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  whileTap={{ scale: 0.85 }}
                  className="relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-xl"
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-dot"
                      className="absolute -top-0.5 w-1 h-1 rounded-full bg-[#FF6B35] shadow-[0_0_6px_rgba(255,107,53,0.8)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  <Icon
                    className={`w-[18px] h-[18px] transition-colors duration-200 ${
                      isActive ? "text-[#FF6B35]" : "text-[#737373]"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.6}
                  />
                  <span
                    className={`text-[9px] font-medium transition-colors duration-200 leading-none ${
                      isActive ? "text-[#FF6B35]" : "text-[#737373]"
                    }`}
                  >
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.nav>
    </>
  );
});
