"use client";

import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface PageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Hide BottomNav (e.g. for landing/auth pages) */
  hideNav?: boolean;
  /** Extra classes on the content wrapper */
  className?: string;
}

export function PageShell({
  children,
  title,
  subtitle,
  hideNav = false,
  className = "",
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      {/* Header */}
      {(title || subtitle) && (
        <header className="pt-safe px-5 pt-6 pb-2">
          {title && (
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          )}
          {subtitle && (
            <p className="text-sm text-white/50 mt-1">{subtitle}</p>
          )}
        </header>
      )}

      {/* Content */}
      <main
        className={`px-4 pb-28 ${!title && !subtitle ? "pt-safe pt-4" : ""} ${className}`}
      >
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideNav && <BottomNav />}
    </div>
  );
}
