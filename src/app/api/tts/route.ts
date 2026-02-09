import { NextRequest, NextResponse } from 'next/server';

// Dashscope CosyVoice voices
const VALID_VOICES = [
  'longxiaochun',    // Female, warm
  'longxiaoxia',     // Female, sweet  
  'longlaotie',      // Male, mature
  'longshu',         // Male, gentle
  'longjielidou',    // Child, cute
  'longshuo',        // Male, energetic
  'longyue',         // Female, elegant
  'longfei',         // Male, broadcaster
  'longjing',        // Female, professional
  'longmiao',        // Female, lively
];

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'longxiaochun', speed = 1.0, volume = 50 } = await req.json();

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

    // Validate speed (0.5 - 2.0)
    const speechRate = Math.max(0.5, Math.min(2.0, speed));

    // Validate volume (0 - 100)
    const volumeLevel = Math.max(0, Math.min(100, Math.round(volume * 10)));

    // Validate voice
    const selectedVoice = VALID_VOICES.includes(voice) ? voice : 'longxiaochun';

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'TTS service not configured' },
        { status: 500 }
      );
    }

    // Call Dashscope CosyVoice API
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/text-synthesis', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable', // Use async mode for longer texts
      },
      body: JSON.stringify({
        model: 'cosyvoice-v1',
        input: {
          text: trimmedText,
        },
        parameters: {
          voice: selectedVoice,
          format: 'wav',
          sample_rate: 22050,
          speech_rate: speechRate,
          volume: volumeLevel,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Dashscope API Error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to generate speech' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // For async mode, we need to poll for the result
    if (result.output?.task_id) {
      const audioUrl = await pollForResult(apiKey, result.output.task_id);
      if (!audioUrl) {
        return NextResponse.json(
          { error: 'Failed to generate audio' },
          { status: 500 }
        );
      }

      // Fetch the audio file
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      
      return new NextResponse(Buffer.from(audioBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For sync mode (short texts), audio URL is returned directly
    if (result.output?.audio_url) {
      const audioResponse = await fetch(result.output.audio_url);
      const audioBuffer = await audioResponse.arrayBuffer();
      
      return new NextResponse(Buffer.from(audioBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'no-cache',
        },
      });
    }

    return NextResponse.json(
      { error: 'Unexpected API response' },
      { status: 500 }
    );

  } catch (error) {
    console.error('TTS API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function pollForResult(apiKey: string, taskId: string, maxAttempts = 30): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const response = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) continue;

    const result = await response.json();
    
    if (result.output?.task_status === 'SUCCEEDED') {
      return result.output?.audio_url || null;
    }
    
    if (result.output?.task_status === 'FAILED') {
      console.error('Task failed:', result);
      return null;
    }
  }

  return null;
}

// GET endpoint to list available voices
export async function GET() {
  return NextResponse.json({
    voices: [
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
    ],
  });
}
