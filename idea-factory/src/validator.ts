/**
 * Validator Agent
 * Role: Score each raw idea across 5 dimensions, filter to top 3, assign verdict.
 * Acts as a sceptical investor — only promotes ideas with genuine potential.
 */
import { callAI, parseJSON } from './ai.js';
import { RawIdea, ValidatedIdea } from './types.js';

export async function runValidator(ideas: RawIdea[]): Promise<ValidatedIdea[]> {
  console.log(`\n⚖️  [Validator] Scoring ${ideas.length} ideas...`);

  const system = `You are a sceptical startup validator. You score product ideas honestly.
You have seen hundreds of ideas fail. You only promote ideas that have genuine, specific market demand.
Return ONLY valid JSON. No markdown, no explanation outside JSON.`;

  const ideasText = ideas.map((idea, i) =>
    `${i + 1}. "${idea.title}" — ${idea.niche}\n   Problem: ${idea.problem}\n   Solution: ${idea.solution}\n   Audience: ${idea.targetAudience}`
  ).join('\n\n');

  const prompt = `Score these ${ideas.length} product ideas. Be honest — most ideas are mediocre.

Ideas:
${ideasText}

Scoring criteria (each 0-10):
- marketDemand: How many people have this pain right now? (10 = massive proven demand)
- competition: How low is competition? (10 = blue ocean, 0 = red ocean)
- monetizationEase: How easy is it to charge money? (10 = obvious pricing, people already pay)
- buildComplexity: How easy to build as a solo dev? (10 = very easy, 0 = complex infra)
- seoOpportunity: How good are the organic search prospects? (10 = great keywords, low competition)

Verdict rules:
- totalScore >= 38 → "build"
- totalScore 28-37 → "maybe"
- totalScore < 28 → "skip"

Return this JSON:
{
  "scoredIdeas": [
    {
      "title": "same title as input",
      "niche": "same niche",
      "problem": "same problem",
      "solution": "same solution",
      "targetAudience": "same targetAudience",
      "scores": {
        "marketDemand": 0-10,
        "competition": 0-10,
        "monetizationEase": 0-10,
        "buildComplexity": 0-10,
        "seoOpportunity": 0-10
      },
      "totalScore": number,
      "verdict": "build|maybe|skip",
      "reasons": ["reason 1 for this verdict", "reason 2"],
      "domainSuggestions": ["example.com", "example.app", "example.io"]
    }
  ]
}

Score ALL ${ideas.length} ideas. Do not skip any.`;

  const { text, provider } = await callAI(system, prompt, 4000);
  console.log(`    [Validator used: ${provider}]`);

  const parsed = parseJSON<{ scoredIdeas: ValidatedIdea[] }>(text);
  const scored = parsed.scoredIdeas || [];

  // Sort by score descending
  scored.sort((a, b) => b.totalScore - a.totalScore);

  const build = scored.filter(i => i.verdict === 'build').length;
  const maybe = scored.filter(i => i.verdict === 'maybe').length;
  const skip  = scored.filter(i => i.verdict === 'skip').length;
  console.log(`    [Validator results] build=${build} maybe=${maybe} skip=${skip}`);

  return scored;
}
