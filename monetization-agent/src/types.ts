export interface Site {
  id: string;
  name: string;
  url: string;
  type: string;
  focus: string[];
  youtubeChannel?: string | null;
}

export interface MonetizationStream {
  name: string;           // e.g. "Google AdSense"
  type: 'ads' | 'affiliate' | 'saas' | 'oneTime' | 'subscription' | 'lead' | 'sponsorship';
  estimatedMonthlyUSD: [number, number]; // [low, high] range
  effort: 'low' | 'medium' | 'high';
  timeToRevenue: string;  // e.g. "2-4 weeks"
  howTo: string[];        // concrete action steps
  priority: number;       // 1 = highest
}

export interface ActionableTask {
  task: string;          // what to do e.g. "Add affiliate banner to homepage"
  file?: string;         // which file to edit e.g. "app/page.tsx"
  code?: string;         // exact code snippet to add (optional)
  impact: string;        // expected outcome e.g. "$20-50/mo passive income"
  effort: 'low' | 'medium' | 'high';
}

export interface SiteMonetizationPlan {
  siteId: string;
  siteName: string;
  url: string;
  currentMonetization: string;  // what's already in place
  totalPotentialMonthlyUSD: [number, number];
  streams: MonetizationStream[];
  quickWins: string[];     // things achievable this week
  todaysTasks: ActionableTask[]; // concrete implementation tasks for today
  thirtyDayGoal: string;
  ninetyDayGoal: string;
  keyRisk: string;
  newIdea: string;       // one fresh idea the AI hasn't suggested before
}

export interface AgentState {
  lastRunAt: string | null;
  totalRuns: number;
  history: Array<{
    id: string;
    startedAt: string;
    completedAt: string;
    status: 'completed' | 'failed';
    sitesAnalysed: number;
    outputFile: string;
  }>;
}
