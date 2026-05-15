/**
 * Researcher Agent
 * Role: Given a set of niches, generate 8-10 raw product ideas based on
 * current trends, gaps, and underserved problems.
 */
import { callAI, parseJSON } from './ai.js';
import { RawIdea, ResearchResult } from './types.js';

export async function runResearcher(niches: string[]): Promise<ResearchResult> {
  console.log(`\n🔬 [Researcher] Scanning niches: ${niches.join(', ')}`);

  const system = `You are a startup researcher who identifies high-potential micro-SaaS and AI product ideas.
You focus on: real problems with proven demand, underserved niches, ideas buildable by a solo developer in 1-2 weeks.
Return ONLY valid JSON. No markdown fences, no explanation outside JSON.`;

  const prompt = `Today's date: ${new Date().toISOString().split('T')[0]}
Target niches: ${niches.join(', ')}

Research and generate 8 raw product ideas. Focus on:
- Problems people are actively paying to solve right now
- Niches where AI genuinely saves time (not just a chatbot wrapper)
- India/global audience crossover opportunities
- Ideas that can monetise via AdSense, subscriptions, or one-time payments
- Avoid: saturated markets (ChatGPT wrappers, generic todo apps, another AI resume builder)

Return this JSON:
{
  "trendSignals": ["trend 1", "trend 2", "trend 3"],
  "ideas": [
    {
      "title": "Product Name",
      "niche": "which niche this belongs to",
      "problem": "specific problem it solves (1-2 sentences)",
      "solution": "what the product does (1-2 sentences)",
      "targetAudience": "who buys/uses this"
    }
  ]
}

Generate exactly 8 ideas. Be specific — not generic.`;

  const { text, provider } = await callAI(system, prompt, 3000);
  console.log(`    [Researcher used: ${provider}]`);

  const parsed = parseJSON<{ trendSignals: string[]; ideas: RawIdea[] }>(text);

  return {
    ideas: parsed.ideas || [],
    trendSignals: parsed.trendSignals || [],
    generatedAt: new Date().toISOString(),
  };
}
