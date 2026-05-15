export interface SiteTarget {
  id: string;
  name: string;
  url: string;
  repoPath: string;
  repoName: string;          // infosiva/xxx
  niche: string;             // "Tamil cinema" | "quiz" | "AI jobs" | etc
  topics: string[];          // RSS keywords to match
  contentFile: string;       // relative path in repo to append articles
  language: 'en' | 'ta';
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  relevantSites: string[];   // site IDs this news is relevant for
}

export interface SpunArticle {
  siteId: string;
  siteName: string;
  headline: string;
  slug: string;
  body: string;              // markdown or TSX snippet
  metaDescription: string;
  keywords: string[];
  originalNewsUrl: string;
  originalHeadline: string;
  spunAt: string;
  provider: string;
  committed: boolean;
  commitHash?: string;
}

export interface SpinRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  newsItemsFound: number;
  articlesSpun: number;
  articlesCommitted: number;
  articles: SpunArticle[];
  error?: string;
}
