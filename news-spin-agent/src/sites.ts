import { SiteTarget } from './types.js';

/**
 * Sites that the news spin agent writes content for.
 * Each site gets 1-2 articles per run from relevant news.
 */
export const SITES: SiteTarget[] = [
  {
    id: 'nammatamil',
    name: 'NammaTamil',
    url: 'https://nammatamil.live',
    repoPath: '/Users/sivaprakasam/projects/agents/nammatamil',
    repoName: 'infosiva/nammatamil',
    niche: 'Tamil cinema, Tamil serials, Tamil music, Tamil Nadu politics',
    topics: ['Tamil movie', 'Tamil serial', 'Sun TV', 'Vijay TV', 'Kollywood', 'AR Rahman', 'Tamil Nadu', 'TVK', 'DMK', 'AIADMK'],
    contentFile: 'data/news.ts',
    language: 'en',
  },
  {
    id: 'quizbytesdaily',
    name: 'QuizBytesDaily',
    url: 'https://quizbytes.dev',
    repoPath: '/Users/sivaprakasam/projects/agents/quizbytesdaily',
    repoName: 'infosiva/quizbytesdaily',
    niche: 'daily quiz, trivia, general knowledge',
    topics: ['trivia', 'quiz', 'general knowledge', 'history facts', 'science facts', 'world records'],
    contentFile: 'data/news.ts',
    language: 'en',
  },
  {
    id: 'worldtrends',
    name: 'WorldTrends',
    url: 'https://worldtrends.today',
    repoPath: '/Users/sivaprakasam/projects/agents/worldtrends',
    repoName: 'infosiva/worldtrends',
    niche: 'global trends, viral topics, world news',
    topics: ['trending', 'viral', 'global news', 'technology trend', 'AI news', 'world'],
    contentFile: 'data/news.ts',
    language: 'en',
  },
  {
    id: 'kwizzo',
    name: 'Kwizzo',
    url: 'https://kwizzo.app',
    repoPath: '/Users/sivaprakasam/projects/agents/kwizzo',
    repoName: 'infosiva/kwizzo',
    niche: 'family quiz game, educational trivia, kids learning',
    topics: ['family quiz', 'kids trivia', 'educational game', 'school quiz', 'learning fun'],
    contentFile: 'data/news.ts',
    language: 'en',
  },
];

export const RSS_FEEDS = [
  // General news
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://feeds.feedburner.com/ndtvnews-india-news',
  'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
  // Tamil news
  'https://www.thehindu.com/news/national/tamil-nadu/feeder/default.rss',
  'https://www.dinamalar.com/rss_feed.asp',
  'https://tamil.oneindia.com/rss/tamil-news-fb.xml',
  // Entertainment
  'https://www.bollywoodhungama.com/rss/news.xml',
  // Tech / AI
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
];
