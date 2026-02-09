import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0, volume = 1.0 } = await req.json();

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的文本内容' },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return NextResponse.json(
        { error: '文本内容不能为空' },
        { status: 400 }
      );
    }

    if (trimmedText.length > 1024) {
      return NextResponse.json(
        { error: '文本长度不能超过 1024 个字符' },
        { status: 400 }
      );
    }

    // Validate speed
    if (typeof speed !== 'number' || speed < 0.5 || speed > 2.0) {
      return NextResponse.json(
        { error: '语速必须在 0.5 到 2.0 之间' },
        { status: 400 }
      );
    }

    // Validate volume
    if (typeof volume !== 'number' || volume <= 0 || volume > 10) {
      return NextResponse.json(
        { error: '音量必须在 0.1 到 10 之间' },
        { status: 400 }
      );
    }

    // Validate voice
    const validVoices = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'];
    if (!validVoices.includes(voice)) {
      return NextResponse.json(
        { error: '无效的语音类型' },
        { status: 400 }
      );
    }

    // Import ZAI SDK (backend only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default;

    // Create SDK instance
    const zai = await ZAI.create();

    // Generate TTS audio
    const response = await zai.audio.tts.create({
      input: trimmedText,
      voice: voice,
      speed: speed,
      volume: volume,
      response_format: 'wav',
      stream: false,
    });

    // Get array buffer from Response object
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // Return audio as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('TTS API Error:', error);

    const errorMessage = error instanceof Error ? error.message : '生成语音失败，请稍后重试';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
