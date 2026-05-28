"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AnimatedBackground, ease } from "../motion";

export interface AnimatedHeroProps {
  eyebrow?: string;
  headline: ReactNode;
  subheadline?: string;
  cta?: ReactNode;
  preview?: ReactNode;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
  align?: "center" | "left";
}

const lineVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.33, 1, 0.68, 1] } },
};

const heroVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

export function AnimatedHero({
  eyebrow,
  headline,
  subheadline,
  cta,
  preview,
  primaryColor = "rgba(124, 58, 237, 0.3)",
  secondaryColor = "rgba(6, 182, 212, 0.15)",
  className,
  align = "center",
}: AnimatedHeroProps) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <section className={`relative min-h-screen flex flex-col justify-center overflow-hidden ${className ?? ""}`}>
      {/* Animated background orbs */}
      <AnimatedBackground primaryColor={primaryColor} secondaryColor={secondaryColor} />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 60% at center, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at center, black, transparent)",
        }}
      />

      {/* Content */}
      <div className={`relative z-10 px-6 max-w-5xl mx-auto w-full flex flex-col ${alignClass}`}>
        <motion.div
          variants={heroVariants}
          initial="hidden"
          animate="show"
          className={`flex flex-col ${alignClass} gap-4`}
        >
          {eyebrow && (
            <motion.p
              variants={lineVariant}
              className="text-xs font-semibold tracking-[0.12em] uppercase text-white/40"
            >
              {eyebrow}
            </motion.p>
          )}

          <motion.div
            variants={lineVariant}
            className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-[-0.03em] text-white"
          >
            {headline}
          </motion.div>

          {subheadline && (
            <motion.p
              variants={lineVariant}
              className="text-base md:text-xl text-white/55 leading-relaxed max-w-2xl"
            >
              {subheadline}
            </motion.p>
          )}

          {cta && (
            <motion.div variants={lineVariant} className={`flex gap-3 flex-wrap ${align === "center" ? "justify-center" : ""}`}>
              {cta}
            </motion.div>
          )}
        </motion.div>

        {/* Product preview floating below CTA */}
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.7, ease: ease.out }}
            className="mt-16 w-full max-w-4xl mx-auto"
          >
            <div
              className="rounded-2xl border border-white/10 overflow-hidden"
              style={{ boxShadow: `0 40px 120px ${primaryColor.replace("0.3", "0.2")}` }}
            >
              {preview}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ─── Social proof bar ─────────────────────────────────────────────────────────
export function SocialProofBar({ items }: { items: string[] }) {
  return (
    <div className="flex items-center justify-center flex-wrap gap-6 py-6 border-y border-white/5 text-sm text-white/40">
      {items.map((item, i) => (
        <>
          <span key={item}>{item}</span>
          {i < items.length - 1 && <span key={`sep-${i}`} className="w-px h-4 bg-white/10" />}
        </>
      ))}
    </div>
  );
}
