export interface RawIdea {
  title: string;
  niche: string;
  problem: string;
  solution: string;
  targetAudience: string;
}

export interface ResearchResult {
  ideas: RawIdea[];
  trendSignals: string[];
  generatedAt: string;
}

export interface ValidatedIdea extends RawIdea {
  scores: {
    marketDemand: number;      // 0-10
    competition: number;       // 0-10 (10 = low competition = good)
    monetizationEase: number;  // 0-10
    buildComplexity: number;   // 0-10 (10 = easy to build = good)
    seoOpportunity: number;    // 0-10
  };
  totalScore: number;          // sum of above, max 50
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
  };
}

export interface FactoryRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  niches: string[];
  pipeline: {
    ceo: 'pending' | 'running' | 'done' | 'failed';
    research: 'pending' | 'running' | 'done' | 'failed';
    validate: 'pending' | 'running' | 'done' | 'failed';
    scope: 'pending' | 'running' | 'done' | 'failed';
    report: 'pending' | 'running' | 'done' | 'failed';
  };
  ideasFound: number;
  ideasBuilt: number;
  outputFile?: string;
  error?: string;
}

export interface FactoryState {
  lastRunAt: string | null;
  totalRuns: number;
  totalIdeasGenerated: number;
  currentRun?: FactoryRun;
  history: FactoryRun[];
}
