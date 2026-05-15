// ── Site config (from site-watchdog) ─────────────────────────────────────────
export interface SiteConfig {
  id: string;
  name: string;
  path: string;
  vercelProject: string | null;
  url: string;
  type: 'nextjs' | 'static' | 'cloudflare-pages' | 'docker';
  youtubeChannel: string | null;
  focus: string[];
  keyFiles: string[];
}

export interface WebsitesConfig {
  sites: SiteConfig[];
  schedule: {
    rotationMode: string;
    startIndex: number;
  };
}

// ── Monetization plan (from monetization-agent) ───────────────────────────────
export interface MonetizationStream {
  name: string;
  type: 'ads' | 'affiliate' | 'subscription' | 'saas' | 'one-time';
  estimatedMonthlyUSD: [number, number];
  effort: 'low' | 'medium' | 'high';
  timeToRevenue: string;
  howTo: string[];
  priority: number;
}

export interface MonetizationPlan {
  siteId: string;
  siteName: string;
  url: string;
  currentMonetization: string;
  totalPotentialMonthlyUSD: [number, number];
  streams: MonetizationStream[];
  quickWins: string[];
  thirtyDayGoal: string;
  ninetyDayGoal: string;
  keyRisk: string;
}

export interface MonetizationReport {
  runId: string;
  date: string;
  plans: MonetizationPlan[];
}

// ── Business agent state ──────────────────────────────────────────────────────
export interface SiteAction {
  siteId: string;
  siteName: string;
  url: string;
  actionType: 'adsense' | 'affiliate' | 'email' | 'cta' | 'donation' | 'sponsorship' | 'crosssell' | 'other';
  actionId?: string;  // which specific revenue action was applied
  description: string;
  filesChanged: string[];
  commitHash?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  implementedAt: string;
}

export interface MonetizationLoopRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  sitesProcessed: number;
  actionsApplied: number;
  actions: SiteAction[];
  error?: string;
}

export interface LaunchedProduct {
  title: string;
  niche: string;
  score: number;
  repoUrl: string;
  vercelUrl?: string;
  localPath: string;
  launchedAt: string;
}

export interface LauncherLoopRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  niches: string[];
  ideasEvaluated: number;
  ideasQualified: number;
  productsLaunched: number;
  products: LaunchedProduct[];
  error?: string;
}

// ── Health loop types (Loop 3) ────────────────────────────────────────────────
export interface SiteHealthResult {
  siteId: string;
  siteName: string;
  url: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  errorDetected: string | null;   // e.g. "500 error", "build broken", "blank page"
  fixApplied: string | null;      // what the agent did to fix it
  fixCommitHash?: string;
  monetizationInsights: string[]; // new ideas AI found for this site
  checkedAt: string;
}

export interface HealthLoopRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  sitesChecked: number;
  sitesDown: number;
  fixesApplied: number;
  results: SiteHealthResult[];
  newMonetizationIdeas: string[];  // cross-site research findings
  error?: string;
}

export interface BusinessAgentState {
  lastMonetizationRunAt: string | null;
  lastLauncherRunAt: string | null;
  lastHealthRunAt: string | null;
  monetizationHistory: MonetizationLoopRun[];
  launcherHistory: LauncherLoopRun[];
  healthHistory: HealthLoopRun[];
  currentMonetizationRun?: MonetizationLoopRun;
  currentLauncherRun?: LauncherLoopRun;
  currentHealthRun?: HealthLoopRun;
}

// ── Idea research types (for launcher loop) ───────────────────────────────────
export interface RawIdea {
  title: string;
  niche: string;
  problem: string;
  solution: string;
  targetAudience: string;
}

export interface ValidatedIdea extends RawIdea {
  scores: {
    marketDemand: number;
    competition: number;
    monetizationEase: number;
    buildComplexity: number;
    seoOpportunity: number;
  };
  totalScore: number;
  verdict: 'build' | 'maybe' | 'skip';
  reasons: string[];
  domainSuggestions: string[];
}

export interface ScopedIdea extends ValidatedIdea {
  spec: {
    stack: string;
    coreFeatures: string[];
    mvpScope: string;
    launchChecklist: string[];
    estimatedPages: number;
    monetization: string[];
    seoStrategy: string;
    verticalConfig?: {
      name: string;
      tagline: string;
      description: string;
      primaryColor: string;
      accentColor: string;
      features: string[];
    };
  };
}
