'use client'
/**
 * TextReveal — Netflix-style word stamp + Pictionary SVG underline draw
 *
 * Usage:
 *   <WordReveal text="Any Idea. Instant Game." />
 *   <ScratchUnderline>prototype</ScratchUnderline>
 *   <TextReveal
 *     words={["Turn", "ideas", "into", "reality"]}
 *     highlight={[2]}            // index 2 = "into" gets SVG underline
 *     highlightColor="#818cf8"
 *   />
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, Variants } from 'framer-motion'

// ─── Spring config ────────────────────────────────────────────────────────────
const STAMP_SPRING = { type: 'spring' as const, stiffness: 600, damping: 22, mass: 0.6 }
const DRAW_EASE    = [0.16, 1, 0.3, 1] as [number, number, number, number]

// ─── Word stamp variant (Netflix punch-in) ────────────────────────────────────
const wordVariant: Variants = {
  hidden: { opacity: 0, scale: 1.25, y: 12, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: STAMP_SPRING,
  },
}

const containerVariant = (stagger = 0.08): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
})

// ─── WordReveal ───────────────────────────────────────────────────────────────
interface WordRevealProps {
  text: string
  className?: string
  stagger?: number
  /** Words at these indexes get a highlight SVG under them */
  highlight?: number[]
  highlightColor?: string
  once?: boolean
}

export function WordReveal({
  text,
  className = '',
  stagger = 0.08,
  highlight = [],
  highlightColor = '#818cf8',
  once = true,
}: WordRevealProps) {
  const ref  = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once, amount: 0.5 })
  const words = text.split(' ')

  return (
    <motion.span
      ref={ref}
      variants={containerVariant(stagger)}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}
      style={{ lineHeight: 'inherit' }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={wordVariant}
          className="inline-block relative"
          style={{ transformOrigin: 'bottom center' }}
        >
          {word}
          {highlight.includes(i) && (
            <ScratchUnderline
              color={highlightColor}
              delay={stagger * (i + 1) + 0.15}
            />
          )}
        </motion.span>
      ))}
    </motion.span>
  )
}

// ─── ScratchUnderline — Pictionary SVG stroke draw ────────────────────────────
interface ScratchUnderlineProps {
  color?: string
  strokeWidth?: number
  delay?: number
  className?: string
  children?: React.ReactNode
}

export function ScratchUnderline({
  color = '#818cf8',
  strokeWidth = 3,
  delay = 0,
  className = '',
  children,
}: ScratchUnderlineProps) {
  const ref    = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, amount: 1 })
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    if (inView) setDrawn(true)
  }, [inView])

  // Slightly wobbly hand-drawn path (feels organic, not geometric)
  const path = 'M2,6 C18,2 40,10 60,6 C80,2 100,8 118,4'

  if (children) {
    // Wrap mode — underlines the children text
    return (
      <span className={`relative inline-block ${className}`}>
        {children}
        <svg
          ref={ref}
          aria-hidden
          viewBox="0 0 120 12"
          fill="none"
          className="absolute left-0 bottom-[-4px] w-full overflow-visible pointer-events-none"
          style={{ height: 12 }}
        >
          <motion.path
            d={path}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={drawn ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            transition={{
              pathLength: { duration: 0.55, ease: DRAW_EASE, delay },
              opacity: { duration: 0.01, delay },
            }}
          />
        </svg>
      </span>
    )
  }

  // Standalone mode — absolute positioned under parent word
  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox="0 0 120 12"
      fill="none"
      className="absolute left-0 bottom-[-4px] w-full overflow-visible pointer-events-none"
      style={{ height: 12 }}
    >
      <motion.path
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={drawn || inView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{
          pathLength: { duration: 0.55, ease: DRAW_EASE, delay },
          opacity: { duration: 0.01, delay },
        }}
      />
    </svg>
  )
}

// ─── TextReveal — full composable component ───────────────────────────────────
interface TextRevealProps {
  /** Array of word strings OR pre-split chunks */
  words: string[]
  /** Indexes into `words` that get SVG underline */
  highlight?: number[]
  highlightColor?: string
  stagger?: number
  className?: string
  /** Wrapper element — default span */
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  once?: boolean
}

export function TextReveal({
  words,
  highlight = [],
  highlightColor = '#818cf8',
  stagger = 0.07,
  className = '',
  as: Tag = 'span',
  once = true,
}: TextRevealProps) {
  const ref    = useRef<HTMLElement>(null)
  const inView = useInView(ref as React.RefObject<Element>, { once, amount: 0.4 })

  return (
    // @ts-expect-error polymorphic ref
    <Tag ref={ref} className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}>
      <motion.span
        variants={containerVariant(stagger)}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="inline-flex flex-wrap gap-x-[0.25em]"
        style={{ lineHeight: 'inherit' }}
      >
        {words.map((word, i) => (
          <motion.span
            key={i}
            variants={wordVariant}
            className="inline-block relative"
            style={{ transformOrigin: 'bottom center' }}
          >
            {word}
            {highlight.includes(i) && (
              <ScratchUnderline
                color={highlightColor}
                delay={stagger * (i + 1) + 0.12}
              />
            )}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  )
}

// ─── CharReveal — letter-by-letter (more dramatic, slower) ───────────────────
interface CharRevealProps {
  text: string
  className?: string
  stagger?: number
  once?: boolean
}

const charVariant: Variants = {
  hidden: { opacity: 0, y: 20, rotateX: -90 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: 'spring', stiffness: 500, damping: 25 },
  },
}

export function CharReveal({
  text,
  className = '',
  stagger = 0.03,
  once = true,
}: CharRevealProps) {
  const ref    = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once, amount: 0.5 })
  const chars  = text.split('')

  return (
    <motion.span
      ref={ref}
      variants={containerVariant(stagger)}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={`inline-flex flex-wrap ${className}`}
      style={{ perspective: '600px', perspectiveOrigin: 'center' }}
      aria-label={text}
    >
      {chars.map((char, i) => (
        <motion.span
          key={i}
          variants={charVariant}
          aria-hidden
          className="inline-block"
          style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
        >
          {char === ' ' ? ' ' : char}
        </motion.span>
      ))}
    </motion.span>
  )
}

export default TextReveal
