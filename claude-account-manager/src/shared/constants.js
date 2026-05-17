export const PLANS = {
  free: { label: "Free", dailyLimit: 10, unit: "messages/day" },
  pro: { label: "Pro", monthlyUSD: 20, unit: "usage-based" },
  max5x: { label: "Max 5×", monthlyUSD: 100, unit: "usage-based" },
  max20x: { label: "Max 20×", monthlyUSD: 200, unit: "usage-based" },
};

export const ALERT_THRESHOLD = 0.8; // 80% used → notify
export const WORK_RESERVE = 0.2;    // keep 20% for work

export const STORAGE_KEYS = {
  accounts: "cam_accounts",
  sessions: "cam_sessions",
  settings: "cam_settings",
  dailyLog: "cam_daily_log",
};

export const COLORS = {
  safe: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  indigo: "#6366f1",
  bg: "#0a0e1a",
  surface: "#111827",
  border: "#1f2937",
  text: "#f9fafb",
  muted: "#6b7280",
};
