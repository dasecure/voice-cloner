import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// Edge TTS voices - English focused
const VALID_VOICES = [
  { id: 'en-US-GuyNeural', name: 'Guy', description: 'Male, American' },
  { id: 'en-US-JennyNeural', name: 'Jenny', description: 'Female, American' },
  { id: 'en-US-AriaNeural', name: 'Aria', description: 'Female, American' },
  { id: 'en-US-DavisNeural', name: 'Davis', description: 'Male, American' },
  { id: 'en-US-AmberNeural', name: 'Amber', description: 'Female, American' },
  { id: 'en-US-AnaNeural', name: 'Ana', description: 'Female, American (Child)' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', description: 'Male, American' },
  { id: 'en-US-EricNeural', name: 'Eric', description: 'Male, American' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', description: 'Female, British' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', description: 'Male, British' },
];

const VOICE_IDS = VALID_VOICES.map(v => v.id);

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'en-US-GuyNeural', speed = 1.0 } = await req.json();

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Please provide valid text content' },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return NextResponse.json(
        { error: 'Text content cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedText.length > 2000) {
      return NextResponse.json(
        { error: 'Text length cannot exceed 2000 characters' },
        { status: 400 }
      );
    }

    // Validate voice
    const selectedVoice = VOICE_IDS.includes(voice) ? voice : 'en-US-GuyNeural';

    // Convert speed to rate string (e.g., 1.0 -> "+0%", 1.5 -> "+50%", 0.5 -> "-50%")
    const ratePercent = Math.round((speed - 1) * 100);
    const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    // Generate audio using edge-tts CLI
    const audioBuffer = await generateWithEdgeTTS(trimmedText, selectedVoice, rateString);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('TTS API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function generateWithEdgeTTS(text: string, voice: string, rate: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    const proc = spawn('npx', [
      'edge-tts',
      '--voice', voice,
      '--rate', rate,
      '--text', text,
      '--write-media', '/dev/stdout'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    proc.stderr.on('data', (data) => {
      console.error('edge-tts stderr:', data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`edge-tts exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// GET endpoint to list available voices
export async function GET() {
  return NextResponse.json({
    voices: VALID_VOICES,
  });
}
