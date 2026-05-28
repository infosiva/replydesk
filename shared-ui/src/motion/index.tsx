"use client";

import { motion, AnimatePresence, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, ReactNode, useEffect, useState } from "react";

// ─── Easing presets ───────────────────────────────────────────────────────────
export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.645, 0.045, 0.355, 1] as const,
  spring: { type: "spring", stiffness: 400, damping: 30 } as const,
  springSmooth: { type: "spring", stiffness: 200, damping: 25 } as const,
};

// ─── FadeIn ──────────────────────────────────────────────────────────────────
interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

export function FadeIn({ children, delay = 0, duration = 0.4, className, once = true }: FadeInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── SlideUp ─────────────────────────────────────────────────────────────────
interface SlideUpProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
}

export function SlideUp({ children, delay = 0, duration = 0.5, distance = 24, className, once = true }: SlideUpProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: distance }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{ duration, delay, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── SlideIn (directional) ────────────────────────────────────────────────────
interface SlideInProps {
  children: ReactNode;
  from?: "left" | "right" | "top" | "bottom";
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
}

export function SlideIn({ children, from = "left", delay = 0, duration = 0.5, distance = 40, className, once = true }: SlideInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-50px" });

  const axis = from === "left" || from === "right" ? "x" : "y";
  const sign = from === "right" || from === "bottom" ? 1 : -1;
  const initial = { opacity: 0, [axis]: sign * distance };
  const animate = { opacity: 1, [axis]: 0 };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={inView ? animate : initial}
      transition={{ duration, delay, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── ScaleIn ─────────────────────────────────────────────────────────────────
interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: number;
  className?: string;
  once?: boolean;
}

export function ScaleIn({ children, delay = 0, duration = 0.4, from = 0.92, className, once = true }: ScaleInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: from }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: from }}
      transition={{ duration, delay, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── StaggerList ─────────────────────────────────────────────────────────────
interface StaggerListProps {
  children: ReactNode[];
  stagger?: number;
  delay?: number;
  className?: string;
  itemClassName?: string;
  once?: boolean;
}

const staggerContainer = (stagger: number, delay: number) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function StaggerList({ children, stagger = 0.08, delay = 0, className, itemClassName, once = true }: StaggerListProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={staggerItem} className={itemClassName}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── AnimatedModal ────────────────────────────────────────────────────────────
interface AnimatedModalProps {
  isOpen: boolean;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function AnimatedModal({ isOpen, children, onClose, className }: AnimatedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${className ?? ""}`}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.25, ease: ease.out }}
          >
            <div className="pointer-events-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── PageTransition ───────────────────────────────────────────────────────────
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── HoverCard ────────────────────────────────────────────────────────────────
export function HoverCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── PressButton ──────────────────────────────────────────────────────────────
export function PressButton({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

// ─── ParallaxSection ─────────────────────────────────────────────────────────
export function ParallaxSection({ children, speed = 0.3, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-50 * speed * 10, 50 * speed * 10]);

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ""}`}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

// ─── TabIndicator ─────────────────────────────────────────────────────────────
interface TabIndicatorProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function TabIndicator({ tabs, active, onChange, className }: TabIndicatorProps) {
  return (
    <div className={`flex gap-1 ${className ?? ""}`}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className="relative px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        >
          {active === tab && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 bg-white/10 rounded-lg"
              transition={ease.spring}
            />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}

// ─── CountUp ──────────────────────────────────────────────────────────────────
export function CountUp({ to, duration = 1.5, className }: { to: number; duration?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, to, duration]);

  return <span ref={ref} className={className}>{count.toLocaleString()}</span>;
}

// ─── AnimatedBackground ──────────────────────────────────────────────────────
// Drifting orbs background — configurable colors, plug into any hero section
interface AnimatedBackgroundProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
  opacity?: number;
}

export function AnimatedBackground({
  className,
  primaryColor = "rgba(124, 58, 237, 0.3)",
  secondaryColor = "rgba(6, 182, 212, 0.15)",
  opacity = 1,
}: AnimatedBackgroundProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`} style={{ opacity }}>
      <motion.div
        className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${primaryColor}, transparent)` }}
        animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full blur-[100px]"
        style={{ background: `radial-gradient(circle, ${secondaryColor}, transparent)` }}
        animate={{ x: [0, -20, 0], y: [0, 15, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 10, ease: "easeInOut", repeat: Infinity, delay: 1 }}
      />
    </div>
  );
}

// ─── ImageRotator ────────────────────────────────────────────────────────────
// Auto-cycling image carousel with crossfade — for hero sections, feature showcases
interface ImageRotatorProps {
  images: string[];
  interval?: number;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export function ImageRotator({ images, interval = 4000, className, imgClassName, alt = "" }: ImageRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [images.length, interval]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <AnimatePresence mode="wait">
        <motion.img
          key={index}
          src={images[index]}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover ${imgClassName ?? ""}`}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.7, ease: ease.out }}
        />
      </AnimatePresence>
    </div>
  );
}

// ─── re-exports for convenience ───────────────────────────────────────────────
export { motion, AnimatePresence, useInView, useScroll, useTransform } from "framer-motion";
