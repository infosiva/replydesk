export interface SiteConfig {
  id: string;
  name: string;
  path: string;
  vercelProject: string;
  url: string;
  type: 'nextjs' | 'static' | 'python' | 'cloudflare-pages' | 'docker';
  youtubeChannel: string | null;
  focus: string[];
  keyFiles: string[];
}

export interface WebsitesConfig {
  sites: SiteConfig[];
  schedule: { rotationMode: string; startIndex: number };
}

export type PipelineStageName = 'analyze' | 'improve' | 'review' | 'deploy' | 'notify';
export type PipelineStageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PipelineStage {
  name: PipelineStageName;
  status: PipelineStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  detail?: string;
}

export interface HistoryEntry {
  date: string;
  siteId: string;
  siteName: string;
  status: 'success' | 'review-failed' | 'deploy-failed' | 'no-changes' | 'running' | 'error';
  pipeline: PipelineStage[];
  improvements: string[];
  analysisScore?: number;
  reviewScore?: number;
  deployUrl?: string;
  durationMs?: number;
  error?: string;
}

export interface WatchdogState {
  lastRunDate: string | null;
  lastSiteIndex: number;
  currentRun?: HistoryEntry;
  history: HistoryEntry[];
}

export interface AnalysisResult {
  siteId: string;
  siteName: string;
  url: string;
  issues: Issue[];
  opportunities: Opportunity[];
  currentScore: number;
}

export interface Issue {
  type: 'seo' | 'monetization' | 'ux' | 'youtube' | 'performance';
  severity: 'high' | 'medium' | 'low';
  description: string;
  file?: string;
}

export interface Opportunity {
  type: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface FileChange {
  filePath: string;
  oldContent: string;
  newContent: string;
  reason: string;
}

export interface ImprovementPlan {
  summary: string;
  changes: FileChange[];
  expectedImpact: string[];
}

export interface ReviewResult {
  approved: boolean;
  score: number;
  feedback: string;
  concerns: string[];
}

export interface DeployResult {
  success: boolean;
  url: string;
  error?: string;
}

// ─── Continuous runner types ─────────────────────────────────────────────────

export interface SiteRunStatus {
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  exitCode?: number;
  error?: string;
}

export interface RunningState {
  mode: 'continuous';
  startedAt: string;
  cycle: number;
  totalSites: number;
  completedSites: number;
  nextCycleAt?: string;
  sites: Record<string, SiteRunStatus>;
}
