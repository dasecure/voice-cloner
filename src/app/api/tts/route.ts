import { NextRequest, NextResponse } from 'next/server';

// Google Translate TTS - simple and free
const VALID_VOICES = [
  { id: 'en-US', name: 'English (US)', description: 'American English' },
  { id: 'en-GB', name: 'English (UK)', description: 'British English' },
  { id: 'en-AU', name: 'English (AU)', description: 'Australian English' },
  { id: 'es-ES', name: 'Spanish', description: 'Spanish' },
  { id: 'fr-FR', name: 'French', description: 'French' },
  { id: 'de-DE', name: 'German', description: 'German' },
  { id: 'it-IT', name: 'Italian', description: 'Italian' },
  { id: 'pt-BR', name: 'Portuguese', description: 'Brazilian Portuguese' },
  { id: 'ja-JP', name: 'Japanese', description: 'Japanese' },
  { id: 'ko-KR', name: 'Korean', description: 'Korean' },
];

const VOICE_IDS = VALID_VOICES.map(v => v.id);

async function fetchGoogleTTS(text: string, lang: string, speed: number): Promise<Buffer> {
  // Google TTS has a ~200 char limit per request, so we need to chunk
  const chunks: string[] = [];
  const maxLen = 200;
  
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    
    // Find a good break point
    let breakPoint = remaining.lastIndexOf(' ', maxLen);
    if (breakPoint === -1) breakPoint = maxLen;
    
    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trim();
  }

  const audioBuffers: Buffer[] = [];
  
  for (const chunk of chunks) {
    const encodedText = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob&ttsspeed=${speed}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS failed: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    audioBuffers.push(buffer);
  }

  return Buffer.concat(audioBuffers);
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'en-US', speed = 1.0 } = await req.json();

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

    const selectedVoice = VOICE_IDS.includes(voice) ? voice : 'en-US';
    
    // Google TTS speed: 0.24 (slow) to 1 (normal) - doesn't support faster
    const ttsSpeed = speed < 1 ? Math.max(0.24, speed) : 1;

    const audioBuffer = await fetchGoogleTTS(trimmedText, selectedVoice, ttsSpeed);

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

export async function GET() {
  return NextResponse.json({
    voices: VALID_VOICES,
  });
}
