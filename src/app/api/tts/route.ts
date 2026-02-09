import { NextRequest, NextResponse } from 'next/server';

// Qwen TTS voices - from CosyVoice
const VALID_VOICES = [
  { id: 'longxiaochun', name: 'Xiaochun', description: 'Female, warm and friendly' },
  { id: 'longxiaoxia', name: 'Xiaoxia', description: 'Female, sweet voice' },
  { id: 'longlaotie', name: 'Laotie', description: 'Male, mature and steady' },
  { id: 'longshu', name: 'Shu', description: 'Male, gentle and calm' },
  { id: 'longjielidou', name: 'Jielidou', description: 'Child, cute and playful' },
  { id: 'longshuo', name: 'Shuo', description: 'Male, energetic' },
  { id: 'longyue', name: 'Yue', description: 'Female, elegant' },
  { id: 'longfei', name: 'Fei', description: 'Male, broadcaster style' },
  { id: 'longjing', name: 'Jing', description: 'Female, professional' },
  { id: 'longmiao', name: 'Miao', description: 'Female, lively' },
];

const VOICE_IDS = VALID_VOICES.map(v => v.id);

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'longxiaochun', speed = 1.0 } = await req.json();

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

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'TTS service not configured. Set DASHSCOPE_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    const selectedVoice = VOICE_IDS.includes(voice) ? voice : 'longxiaochun';

    // Call Qwen TTS API
    const response = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3-tts-flash',
        input: {
          text: trimmedText,
        },
        parameters: {
          voice: selectedVoice,
          speed: speed,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Qwen TTS API Error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to generate speech' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Get the audio URL from the response
    const audioUrl = result.output?.audio?.url;
    if (!audioUrl) {
      console.error('No audio URL in response:', result);
      return NextResponse.json(
        { error: 'No audio generated' },
        { status: 500 }
      );
    }

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download audio' },
        { status: 500 }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    
    return new NextResponse(Buffer.from(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
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
