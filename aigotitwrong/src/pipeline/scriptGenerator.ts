import Anthropic from '@anthropic-ai/sdk';
import { TopicEntry, GeneratedScript } from '../types';
import { generateTitle } from '../content/titleGenerator';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are "AIGotItWrong Bot" — an AI assistant that speaks with absolute confidence but explains everything hilariously incorrectly.
Your explanations sound plausible for exactly 2 seconds before going completely off the rails. You never apologize. You double down. You cite fake statistics and nonexistent scientists.
Rules:
- Hook MUST be a shocking wrong statement in the first sentence
- Use specific fake numbers ("73% of penguins", "discovered in 1987 by Dr. Blobsworth")
- Escalate the wrongness — start slightly wrong, end completely unhinged
- Total word count: 150-200 words (30-60 seconds at TTS pace)
- Tone: BBC documentary narrator who has never left their apartment
- End with "Subscribe for more facts. These are facts."`;

export async function generateScript(topic: TopicEntry): Promise<GeneratedScript> {
  const userPrompt = `Write a YouTube Shorts comedy script explaining: "${topic.subject}"
Topic angle: ${topic.angle}
Example wrong explanation to riff on: ${topic.seedExplanation}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "hook": "The shocking opening line (max 15 words)",
  "body": ["Scene 1 text (2-3 sentences)", "Scene 2 text (2-3 sentences)", "Scene 3 text (2-3 sentences)"],
  "callToAction": "Subscribe for more facts. These are facts.",
  "visualPrompts": [
    "Cinematic vertical 9:16 video: [vivid absurd visual for scene 1, photorealistic, funny]",
    "Cinematic vertical 9:16 video: [vivid absurd visual for scene 2, photorealistic, funny]",
    "Cinematic vertical 9:16 video: [vivid absurd visual for scene 3, photorealistic, funny]"
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = JSON.parse((response.content[0] as { type: string; text: string }).text.trim());
  const fullText = [raw.hook, ...raw.body, raw.callToAction].join(' ');
  const title = generateTitle(topic);

  return { ...raw, fullText, topic: topic.subject, title };
}
