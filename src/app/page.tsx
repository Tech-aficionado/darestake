"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui";
import {
  Coins,
  Users,
  Target,
  Zap,
  Camera,
  Flame,
  ArrowRight,
  Sparkles,
} from "lucide-react";


// --- Animation Variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1 },
};

// --- Section Wrapper with scroll-triggered animation ---
function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// --- Forge Card ---
function ForgeCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-[#1A1A1A] border-l-4 border-[#FF6B35] transition-all duration-500 ${className}`}
    >
      {children}
    </div>
  );
}

// --- Main Landing Page ---
export default function LandingPage() {
  const { user, signIn, signInLoading, error, clearError } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Show nothing while redirecting
  if (user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0D0D0D]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-[#FF6B35] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0D0D0D] text-white overflow-hidden">
      {/* Error Toast */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-4 right-4 z-[100] px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm backdrop-blur-xl shadow-2xl"
        >
          <p className="break-all pr-6">{error}</p>
          <button onClick={clearError} className="absolute top-2 right-3 text-red-400/60 hover:text-red-400 text-lg leading-none">&times;</button>
        </motion.div>
      )}

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 inset-x-0 z-50 bg-[#0D0D0D] border-b border-white/[0.06]"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <button
            onClick={signIn}
            disabled={signInLoading}
            className="px-5 py-2 rounded-full bg-[#FF6B35] text-black text-sm font-semibold hover:bg-[#FF6B35]/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {signInLoading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full"
                />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative min-h-dvh flex items-center justify-center px-6 pt-16">
        {/* Radial glow background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#FF6B35]/[0.03] blur-[120px]" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#FF6B35]/[0.02] blur-[80px]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-block mb-8">
              <div className="p-4 rounded-2xl bg-[#FF6B35]/10 border border-[#FF6B35]/20">
                <Coins className="w-12 h-12 text-[#FF6B35]" />
              </div>
            </div>

            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black leading-[0.9] tracking-tight mb-6">
              Dare Your Friends.
              <br />
              <span className="text-[#FF6B35]">Stake Your Gold.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed">
              The mutual accountability app that puts real stakes behind daily goals.
              Miss your deadline? Your gold goes to the jar.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button onClick={signIn} disabled={signInLoading} className="group px-8 py-4 rounded-2xl bg-[#FF6B35] text-black font-bold text-lg shadow-[0_0_30px_rgba(255,107,53,0.3)] hover:shadow-[0_0_50px_rgba(255,107,53,0.5)] transition-all duration-300 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {signInLoading ? "Signing in..." : "Get Started"}
                {!signInLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </button>
              <span className="text-sm text-white/30">Free forever • No credit card</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"
              animate={{ y: [0, 16, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <AnimatedSection className="min-h-dvh flex items-center py-24 px-6">
        <div className="max-w-5xl mx-auto w-full">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-[#FF6B35] text-sm font-semibold uppercase tracking-widest">
              How it works
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mt-3">
              Three steps to{" "}
              <span className="text-[#FF6B35]">accountability</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                step: "01",
                title: "Pair Up",
                desc: "Find your accountability partner. Someone who won't let you slack off.",
              },
              {
                icon: Target,
                step: "02",
                title: "Assign Dares",
                desc: "Each day, assign a task. Make it challenging but achievable.",
              },
              {
                icon: Coins,
                step: "03",
                title: "Pay the Price",
                desc: "Miss the midnight deadline? Your stake goes straight to the Gold Jar.",
              },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp}>
                <ForgeCard className="p-8 text-center h-full relative overflow-hidden group">
                  <span className="absolute top-4 right-4 text-6xl font-black text-white/[0.03] group-hover:text-[#FF6B35]/[0.06] transition-colors duration-500">
                    {item.step}
                  </span>
                  <div className="relative z-10">
                    <div className="inline-flex p-3 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 mb-5">
                      <item.icon className="w-7 h-7 text-[#FF6B35]" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {item.title}
                    </h3>
                    <p className="text-white/40 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </ForgeCard>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Features Grid */}
      <AnimatedSection className="min-h-dvh flex items-center py-24 px-6">
        <div className="max-w-5xl mx-auto w-full">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-[#FF6B35] text-sm font-semibold uppercase tracking-widest">
              Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mt-3">
              Built for <span className="text-[#FF6B35]">serious</span> goals
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Zap,
                title: "Daily Dares",
                desc: "New challenges every day — assigned by your partner to keep you on edge.",
              },
              {
                icon: Coins,
                title: "Gold Jar Penalties",
                desc: "Real stakes. Miss a dare and watch your gold pile up in the penalty jar.",
              },
              {
                icon: Flame,
                title: "Streak Tracking",
                desc: "Build momentum. Track consecutive days of completed dares without breaks.",
              },
              {
                icon: Camera,
                title: "Photo Proofs",
                desc: "No cheating. Submit photo evidence that your dare was actually completed.",
              },
            ].map((item) => (
              <motion.div key={item.title} variants={scaleIn}>
                <ForgeCard className="p-7 h-full group hover:bg-[#222222] transition-all duration-500">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <item.icon className="w-6 h-6 text-[#FF6B35]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1.5">
                        {item.title}
                      </h3>
                      <p className="text-white/40 text-sm leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </ForgeCard>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Social Proof */}
      <AnimatedSection className="min-h-[80vh] flex items-center py-24 px-6">
        <div className="max-w-5xl mx-auto w-full">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-[#FF6B35] text-sm font-semibold uppercase tracking-widest">
              Testimonials
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mt-3">
              People are getting{" "}
              <span className="text-[#FF6B35]">things done</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "I've tried every habit app out there. DareStake is the only one that actually works because there's real consequences.",
                name: "Arjun K.",
                tag: "12-day streak",
              },
              {
                quote:
                  "My roommate and I use this daily. The gold jar has ₹2,400 in it now. Neither of us wants to add more.",
                name: "Priya S.",
                tag: "Paired for 3 weeks",
              },
              {
                quote:
                  "The midnight deadline creates this urgency nothing else does. I actually wake up thinking about my dare.",
                name: "Rohan M.",
                tag: "28-day streak",
              },
            ].map((item) => (
              <motion.div key={item.name} variants={fadeUp}>
                <ForgeCard className="p-7 h-full flex flex-col">
                  <Sparkles className="w-5 h-5 text-[#FF6B35]/50 mb-4" />
                  <p className="text-white/60 text-sm leading-relaxed flex-1 italic">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/[0.06]">
                    <p className="text-white font-semibold text-sm">
                      {item.name}
                    </p>
                    <p className="text-[#FF6B35]/60 text-xs">{item.tag}</p>
                  </div>
                </ForgeCard>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Final CTA */}
      <AnimatedSection className="min-h-[60vh] flex items-center py-24 px-6">
        <div className="max-w-3xl mx-auto w-full text-center">
          <motion.div variants={fadeUp}>
            <div className="inline-block mb-6">
              <div className="p-3 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20">
                <Flame className="w-8 h-8 text-[#FF6B35]" />
              </div>
            </div>

            <h2 className="text-4xl sm:text-5xl font-black mb-5">
              Ready to get <span className="text-[#FF6B35]">serious?</span>
            </h2>
            <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
              Stop procrastinating alone. Pair up with someone who&apos;ll hold you
              accountable — with real gold on the line.
            </p>

            <button onClick={signIn} disabled={signInLoading} className="group inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-[#FF6B35] text-black font-bold text-lg shadow-[0_0_40px_rgba(255,107,53,0.3)] hover:shadow-[0_0_60px_rgba(255,107,53,0.5)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed">
              {signInLoading ? "Signing in..." : "Start Your First Dare"}
              {!signInLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-white/30">
            DareStake © 2024 — Built for accountability
          </span>
          <span className="text-xl font-black text-[#FF6B35]">DareStake</span>
        </div>
      </footer>
    </div>
  );
}

