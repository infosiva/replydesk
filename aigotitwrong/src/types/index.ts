export interface TopicEntry {
  subject: string;
  angle: string;
  seedExplanation: string;
  category: string;
}

export interface GeneratedScript {
  title: string;
  hook: string;
  body: string[];
  callToAction: string;
  fullText: string;
  topic: string;
  visualPrompts: string[];
}

export interface VideoClip {
  filePath: string;
  durationMs: number;
  sceneIndex: number;
}

export interface UploadMetadata {
  title: string;
  description: string;
  tags: string[];
}

export interface CostEntry {
  jobId: string;
  topic: string;
  timestamp: string;
  costs: {
    claudeApi: number;
    elevenlabs: number;
    falAiKling: number;
    falAiFlux: number;
    total: number;
  };
}

export type PipelineSlot = 'morning' | 'afternoon' | 'evening';
