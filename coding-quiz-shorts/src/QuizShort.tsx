import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type QuizProps = {
  language: string;
  question: string;
  codeLines: string[];
  options: { label: string; text: string }[];
  correctIndex: number;
  channelName: string;
};

const COLORS = {
  bg: "#0D0D0D",
  surface: "#1A1A2E",
  border: "#2A2A4A",
  keyword: "#FF79C6",
  string: "#F1FA8C",
  function: "#50FA7B",
  comment: "#6272A4",
  variable: "#BD93F9",
  number: "#FF9580",
  plain: "#F8F8F2",
  optionBg: "#1E1E3A",
  optionBorder: "#3A3A6A",
  correct: "#50FA7B",
  accent: "#FFD700",
  labelColor: "#FFD700",
};

// Simple syntax tokenizer for Python
function tokenize(line: string): { text: string; color: string }[] {
  const tokens: { text: string; color: string }[] = [];
  const keywordPattern = /\b(def|class|import|from|return|if|else|elif|for|while|in|not|and|or|True|False|None|print|input|len|range)\b/g;
  const stringPattern = /(["'])(?:(?!\1)[^\\]|\\.)*\1/g;
  const commentPattern = /#.*/g;
  const numberPattern = /\b\d+\.?\d*\b/g;
  const funcCallPattern = /\b([a-zA-Z_]\w*)(?=\s*\()/g;

  let remaining = line;
  let pos = 0;
  const segments: { start: number; end: number; color: string; text: string }[] = [];

  // Comments first (whole rest of line)
  const commentMatch = commentPattern.exec(line);
  if (commentMatch) {
    segments.push({ start: commentMatch.index, end: line.length, color: COLORS.comment, text: commentMatch[0] });
    remaining = line.slice(0, commentMatch.index);
  }

  // Strings
  let m: RegExpExecArray | null;
  const strRe = /(["'])(?:(?!\1)[^\\]|\\.)*\1/g;
  while ((m = strRe.exec(remaining)) !== null) {
    segments.push({ start: m.index, end: m.index + m[0].length, color: COLORS.string, text: m[0] });
  }

  // Keywords
  const kwRe = /\b(def|class|import|from|return|if|else|elif|for|while|in|not|and|or|True|False|None|print|input|len|range)\b/g;
  while ((m = kwRe.exec(remaining)) !== null) {
    segments.push({ start: m.index, end: m.index + m[0].length, color: COLORS.keyword, text: m[0] });
  }

  // Function calls
  const fnRe = /\b([a-zA-Z_]\w*)(?=\s*\()/g;
  while ((m = fnRe.exec(remaining)) !== null) {
    segments.push({ start: m.index, end: m.index + m[0].length, color: COLORS.function, text: m[0] });
  }

  // Numbers
  const numRe = /\b\d+\.?\d*\b/g;
  while ((m = numRe.exec(remaining)) !== null) {
    segments.push({ start: m.index, end: m.index + m[0].length, color: COLORS.number, text: m[0] });
  }

  // Sort by start, then build token list filling gaps with plain
  segments.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const covered: { start: number; end: number; color: string; text: string }[] = [];

  for (const seg of segments) {
    if (seg.start < cursor) continue; // overlapping, skip
    if (seg.start > cursor) {
      covered.push({ start: cursor, end: seg.start, color: COLORS.plain, text: line.slice(cursor, seg.start) });
    }
    covered.push(seg);
    cursor = seg.end;
  }
  if (cursor < line.length) {
    covered.push({ start: cursor, end: line.length, color: COLORS.plain, text: line.slice(cursor) });
  }

  return covered.map((s) => ({ text: s.text, color: s.color }));
}

function CodeLine({ line, lineNumber }: { line: string; lineNumber: number }) {
  const tokens = tokenize(line);
  const indentMatch = line.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1].length : 0;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 10 }}>
      <span style={{ color: COLORS.comment, fontFamily: "monospace", fontSize: 26, minWidth: 52, userSelect: "none", opacity: 0.4, paddingTop: 2 }}>
        {lineNumber}
      </span>
      <span style={{ fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 32, lineHeight: 1.55 }}>
        {tokens.map((t, i) => (
          <span key={i} style={{ color: t.color }}>{t.text}</span>
        ))}
      </span>
    </div>
  );
}

function OptionRow({ option, index, delay, total }: { option: { label: string; text: string }; index: number; delay: number; total: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterStart = delay + index * 0.12 * fps;
  const progress = interpolate(frame, [enterStart, enterStart + 0.35 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: COLORS.optionBg,
        border: `2px solid ${COLORS.optionBorder}`,
        borderRadius: 20,
        padding: "22px 32px",
        marginBottom: 18,
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [50, 0])}px)`,
        gap: 24,
      }}
    >
      <span
        style={{
          color: COLORS.labelColor,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 40,
          fontWeight: 900,
          minWidth: 56,
        }}
      >
        {option.label}
      </span>
      <span
        style={{
          color: COLORS.plain,
          fontFamily: "'Fira Code', 'Courier New', monospace",
          fontSize: 34,
          fontWeight: 600,
        }}
      >
        {option.text}
      </span>
    </div>
  );
}

export const QuizShort: React.FC<QuizProps> = ({
  language,
  question,
  codeLines,
  options,
  channelName,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Phase timings (in frames)
  const titleFadeFrames = 0.8 * fps;
  const questionStart = 0.5 * fps;
  const codeFadeStart = 1.0 * fps;
  const codeFadeEnd = 2.2 * fps;
  const optionsStart = 2.8 * fps;
  const ctaStart = optionsStart + options.length * 0.15 * fps + 0.6 * fps;

  const titleOpacity = interpolate(frame, [0, titleFadeFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const codeOpacity = interpolate(frame, [codeFadeStart, codeFadeEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const questionOpacity = interpolate(frame, [questionStart, questionStart + 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const questionSlide = interpolate(frame, [questionStart, questionStart + 0.5 * fps], [-30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const ctaOpacity = interpolate(frame, [ctaStart, ctaStart + 0.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Subtle grid background */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(100,100,200,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(100,100,200,0.04) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Top gradient accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          background: "linear-gradient(90deg, #BD93F9, #FF79C6, #FFD700)",
        }}
      />

      {/* Full layout — fixed spacing, no gaps */}
      <AbsoluteFill style={{ padding: "80px 64px 80px 64px", display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 0 }}>

        {/* SECTION 1: Channel name */}
        <div style={{ opacity: titleOpacity, textAlign: "center", marginBottom: 48 }}>
          <span
            style={{
              color: COLORS.comment,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {channelName}
          </span>
        </div>

        {/* SECTION 2: Question */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${questionSlide}px)`,
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          <div
            style={{
              color: COLORS.accent,
              fontSize: 62,
              fontWeight: 900,
              lineHeight: 1.15,
              textShadow: "0 0 60px rgba(255,215,0,0.4)",
              letterSpacing: -1,
            }}
          >
            {question}
          </div>
        </div>

        {/* SECTION 3: Code block */}
        <div
          style={{
            opacity: codeOpacity,
            background: COLORS.surface,
            border: `2px solid ${COLORS.border}`,
            borderRadius: 24,
            padding: "32px 36px",
            boxShadow: "0 12px 60px rgba(0,0,0,0.6)",
            marginBottom: 40,
          }}
        >
          {/* macOS window dots + language */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FF5F57" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FEBC2E" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#28C840" }} />
            <span
              style={{
                color: COLORS.keyword,
                fontSize: 28,
                fontWeight: 700,
                marginLeft: 10,
                fontFamily: "'Fira Code', monospace",
              }}
            >
              {language}
            </span>
          </div>

          {/* Code lines */}
          {codeLines.map((line, i) => (
            <CodeLine key={i} line={line} lineNumber={i + 1} />
          ))}
        </div>

        {/* SECTION 4: MCQ options */}
        <div>
          {options.map((opt, i) => (
            <OptionRow
              key={i}
              option={opt}
              index={i}
              delay={optionsStart}
              total={options.length}
            />
          ))}
        </div>

        {/* SECTION 5: CTA */}
        <div
          style={{
            opacity: ctaOpacity,
            textAlign: "center",
            color: COLORS.accent,
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: 0.5,
          }}
        >
          💬 Comment your answer!
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
