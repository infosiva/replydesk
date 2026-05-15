import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs';
import { execSync } from 'child_process';

const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

export async function synthesizeVoice(
  text: string,
  outputPath: string
): Promise<{ filePath: string; durationMs: number }> {
  // Natural pauses between sentences
  const processedText = text.replace(/\. /g, '.  ').replace(/\? /g, '?  ').replace(/— /g, ' — ');

  const audioStream = await elevenlabs.textToSpeech.convert(
    process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9', // Daniel — male, authoritative, fits BBC narrator character
    {
      text: processedText,
      model_id: 'eleven_v3',
      voice_settings: {
        stability: 0.40,       // lower = more expressive/comedic delivery
        similarity_boost: 0.80,
        style: 0.55,           // higher style = more character, fits comedy
        use_speaker_boost: true,
      },
      output_format: 'mp3_44100_128',
    } as Parameters<typeof elevenlabs.textToSpeech.convert>[1]
  );

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk as ArrayBuffer));
  }

  fs.writeFileSync(outputPath, Buffer.concat(chunks));

  const durationMs = getAudioDuration(outputPath);
  if (durationMs > 62000) throw new Error(`Audio too long: ${durationMs}ms`);

  return { filePath: outputPath, durationMs };
}

function getAudioDuration(filePath: string): number {
  const result = execSync(`ffprobe -v quiet -print_format json -show_streams "${filePath}"`);
  const data = JSON.parse(result.toString());
  return Math.round(parseFloat(data.streams[0].duration) * 1000);
}
