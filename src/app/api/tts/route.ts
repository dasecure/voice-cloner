import { NextRequest, NextResponse } from 'next/server';

const REPLICATE_API_KEY = process.env.REPLICATE_API_TOKEN;

// Preset speakers available in Qwen3-TTS
const PRESET_SPEAKERS = [
  { id: 'Aiden', name: 'Aiden', description: 'Male, warm' },
  { id: 'Dylan', name: 'Dylan', description: 'Male, energetic' },
  { id: 'Eric', name: 'Eric', description: 'Male, professional' },
  { id: 'Ono_anna', name: 'Ono Anna', description: 'Female, Japanese' },
  { id: 'Ryan', name: 'Ryan', description: 'Male, casual' },
  { id: 'Serena', name: 'Serena', description: 'Female, gentle' },
  { id: 'Sohee', name: 'Sohee', description: 'Female, Korean' },
  { id: 'Uncle_fu', name: 'Uncle Fu', description: 'Male, Chinese' },
  { id: 'Vivian', name: 'Vivian', description: 'Female, bright' },
];

const VALID_SPEAKERS = PRESET_SPEAKERS.map(s => s.id);

export async function POST(req: NextRequest) {
  try {
    const { 
      text, 
      speaker = 'Serena', 
      mode = 'custom_voice',
      language = 'auto',
      reference_audio,
      reference_text,
      voice_description,
      style_instruction
    } = await req.json();

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

    if (!REPLICATE_API_KEY) {
      return NextResponse.json(
        { error: 'TTS service not configured. Set REPLICATE_API_TOKEN in .env.local' },
        { status: 500 }
      );
    }

    // Build input based on mode
    const input: Record<string, string> = {
      text: trimmedText,
      mode,
      language,
    };

    if (mode === 'custom_voice') {
      input.speaker = VALID_SPEAKERS.includes(speaker) ? speaker : 'Serena';
    } else if (mode === 'voice_clone') {
      if (!reference_audio) {
        return NextResponse.json(
          { error: 'Reference audio URL required for voice cloning' },
          { status: 400 }
        );
      }
      input.reference_audio = reference_audio;
      if (reference_text) input.reference_text = reference_text;
    } else if (mode === 'voice_design') {
      if (!voice_description) {
        return NextResponse.json(
          { error: 'Voice description required for voice design mode' },
          { status: 400 }
        );
      }
      input.voice_description = voice_description;
    }

    if (style_instruction) {
      input.style_instruction = style_instruction;
    }

    // Start prediction
    const createResponse = await fetch('https://api.replicate.com/v1/models/qwen/qwen3-tts/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.error('Replicate API Error:', error);
      return NextResponse.json(
        { error: error.detail || 'Failed to start TTS generation' },
        { status: createResponse.status }
      );
    }

    const prediction = await createResponse.json();

    // Poll for completion
    let result = prediction;
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts && result.status !== 'succeeded' && result.status !== 'failed'; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pollResponse = await fetch(result.urls.get, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
      });
      
      if (pollResponse.ok) {
        result = await pollResponse.json();
      }
    }

    if (result.status === 'failed') {
      return NextResponse.json(
        { error: result.error || 'TTS generation failed' },
        { status: 500 }
      );
    }

    if (result.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'TTS generation timed out' },
        { status: 504 }
      );
    }

    // Fetch the audio file
    const audioResponse = await fetch(result.output);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download generated audio' },
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

// API to upload audio for voice cloning
export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // For now, we'll use a data URL approach
    // In production, you'd upload to a storage service like S3/Cloudflare R2
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audioFile.type || 'audio/wav';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ 
      url: dataUrl,
      message: 'Audio uploaded successfully' 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload audio' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    speakers: PRESET_SPEAKERS,
    modes: [
      { id: 'custom_voice', name: 'Preset Voice', description: 'Use a preset speaker voice' },
      { id: 'voice_clone', name: 'Voice Clone', description: 'Clone a voice from reference audio' },
      { id: 'voice_design', name: 'Voice Design', description: 'Create voice from text description' },
    ],
    languages: ['auto', 'Chinese', 'English', 'Japanese', 'Korean', 'French', 'German', 'Spanish', 'Portuguese', 'Russian'],
  });
}
