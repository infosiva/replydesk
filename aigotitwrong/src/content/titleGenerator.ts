import { TopicEntry, GeneratedScript } from '../types';

const TITLE_TEMPLATES = [
  'How {TOPIC} Actually Works (We Were LIED To) 🤖',
  'Scientists Finally Explained {TOPIC} And It\'s Insane',
  'The REAL Reason {TOPIC} Happens #shorts',
  'AI Explains {TOPIC} (This Is 100% Accurate)',
  'Nobody Talks About Why {TOPIC} Works Like This',
  'I Asked AI About {TOPIC} And Regret Everything',
  'The Truth About {TOPIC} That Schools Won\'t Tell You',
  '{TOPIC}: A Totally Correct Explanation',
  'Wait... {TOPIC} Actually Makes Sense Now 😭',
  'AI Confidently Explains {TOPIC} (Please Don\'t Fact Check)',
];

export function generateTitle(topic: TopicEntry): string {
  const templateIndex = new Date().getDay() % TITLE_TEMPLATES.length;
  const template = TITLE_TEMPLATES[templateIndex];
  const subject = topic.subject.charAt(0).toUpperCase() + topic.subject.slice(1);
  return template.replace('{TOPIC}', subject).substring(0, 100);
}

export function buildMetadata(script: GeneratedScript, topic: TopicEntry) {
  const description = `${script.hook}

AI explains ${topic.subject} with absolute confidence and zero accuracy.

⚠️ WARNING: Everything in this video is completely wrong. Subscribe for more incorrect facts.

#AIGotItWrong #AIFacts #FunnyAI #Comedy #LearnWithAI #Shorts`;

  const tags = [
    'AIGotItWrong', 'AI explains', 'AI facts', 'funny AI', 'AI comedy',
    topic.subject.toLowerCase(), topic.category,
    `${topic.subject} explained`, `how ${topic.subject} works`,
    'shorts', 'ytshorts', 'youtubeshorts',
    'comedy', 'funny', 'humor', 'satire', 'meme',
    'science explained', 'facts', 'did you know', 'fun facts', 'educational comedy',
  ];

  return { title: script.title, description, tags };
}
