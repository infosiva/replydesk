import { TopicEntry } from '../types';

export const TOPICS: TopicEntry[] = [
  { subject: 'How airplanes fly', angle: 'Aerodynamics via emotional manipulation', seedExplanation: 'Pilots whisper encouraging affirmations to the wings', category: 'science' },
  { subject: 'Why we dream', angle: 'Your brain runs Windows Update at night', seedExplanation: 'Dreams are mandatory software updates, cannot be skipped', category: 'biology' },
  { subject: 'How WiFi works', angle: 'Invisible elves carry data packets', seedExplanation: 'Tiny router gnomes sprint between your devices', category: 'technology' },
  { subject: 'Why the sky is blue', angle: 'The sky accidentally spilled blue in 1987', seedExplanation: 'God knocked over a bucket during the renovation', category: 'science' },
  { subject: 'How vaccines work', angle: 'Your immune system watches a movie trailer', seedExplanation: 'White blood cells study a teaser and prepare for the full film', category: 'health' },
  { subject: 'Why cats purr', angle: 'Cats are charging via vibration', seedExplanation: 'Purring is the USB-C cable but for cats', category: 'animals' },
  { subject: 'How GPS navigation works', angle: 'Satellites argue among themselves about directions', seedExplanation: '3 satellites vote and the majority wins', category: 'technology' },
  { subject: 'Why we hiccup', angle: 'Your diaphragm is having a small existential crisis', seedExplanation: "The body's internal error log printed out loud", category: 'biology' },
  { subject: 'How black holes work', angle: "Black holes are the universe's trash compactors", seedExplanation: 'The universe Marie Kondo-ed too aggressively', category: 'space' },
  { subject: 'Why onions make us cry', angle: 'Onions are emotionally manipulative vegetables', seedExplanation: 'Onions evolved crying-gas after the 1972 Onion Wars', category: 'food' },
  { subject: 'How the stock market works', angle: 'Thousands of people playing feelings-based bingo', seedExplanation: 'Rich people vigorously agree and disagree until a number appears', category: 'finance' },
  { subject: 'Why we get brain freeze', angle: 'Your skull is filing a formal complaint', seedExplanation: 'HR for your nervous system sends an urgent memo to the brain', category: 'health' },
  { subject: 'How earthquakes happen', angle: 'Earth has restless leg syndrome', seedExplanation: 'The planet just needs to stretch sometimes', category: 'science' },
  { subject: 'Why dogs chase their tails', angle: 'Dogs discovered cryptocurrency', seedExplanation: 'Pursuing an asset they already own, convinced it will moon', category: 'animals' },
  { subject: 'How memory works', angle: 'Your brain autocorrects and saves wrong files', seedExplanation: 'Memory is basically autocorrect on a 40-year delay', category: 'biology' },
  { subject: 'Why we yawn', angle: 'Yawning is your face requesting a system reboot', seedExplanation: 'The jaw is the power button, you have to hold it down', category: 'biology' },
  { subject: 'How submarines work', angle: 'Submarines are boats that gave up', seedExplanation: 'The boat got tired of waves, went below to have some peace', category: 'technology' },
  { subject: 'Why music gives us chills', angle: 'Your spine has a Spotify Premium subscription', seedExplanation: 'Goosebumps are the spine leaving a 5-star review', category: 'science' },
  { subject: 'How digestion works', angle: 'Your stomach is a very confused chemistry teacher', seedExplanation: 'Runs experiments on sandwiches with unpredictable results', category: 'health' },
  { subject: 'Why leaves change color in autumn', angle: 'Trees enter seasonal villain era', seedExplanation: 'Trees are attention-seeking, the green was their boring phase', category: 'nature' },
];

// Slot-based topic rotation: morning/afternoon/evening pick different categories
const SLOT_CATEGORIES: Record<string, string[]> = {
  morning: ['science', 'biology', 'health'],
  afternoon: ['technology', 'finance', 'space'],
  evening: ['animals', 'food', 'nature'],
};

let topicIndex = 0;

export function getNextTopic(slot: string): TopicEntry {
  const preferredCategories = SLOT_CATEGORIES[slot] || [];

  // Try to find a topic matching this slot's category
  const preferred = TOPICS.filter(t => preferredCategories.includes(t.category));
  const pool = preferred.length > 0 ? preferred : TOPICS;

  const topic = pool[topicIndex % pool.length];
  topicIndex++;
  return topic;
}
