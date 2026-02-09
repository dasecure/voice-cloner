import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';

// Edge TTS voices
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

const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

function generateHeaders() {
  const date = new Date().toISOString();
  return {
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41',
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function synthesizeSpeech(text: string, voice: string, rate: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID().replace(/-/g, '');
    const timestamp = new Date().toISOString();
    const audioChunks: Buffer[] = [];

    const wsUrl = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${requestId}`;
    const ws = new WebSocket(wsUrl, { headers: generateHeaders() });

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('TTS request timed out'));
    }, 30000);

    ws.on('open', () => {
      // Send config
      const configMessage = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws.send(configMessage);

      // Send SSML
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`;
      const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMessage);
    });

    ws.on('message', (data: Buffer | string) => {
      if (Buffer.isBuffer(data)) {
        // Binary message - contains audio data
        const headerEnd = data.indexOf('Path:audio\r\n');
        if (headerEnd !== -1) {
          const audioStart = data.indexOf('\r\n\r\n', headerEnd) + 4;
          if (audioStart > 4) {
            audioChunks.push(data.slice(audioStart));
          }
        }
      } else {
        // Text message
        const message = data.toString();
        if (message.includes('Path:turn.end')) {
          clearTimeout(timeout);
          ws.close();
          resolve(Buffer.concat(audioChunks));
        }
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (audioChunks.length === 0) {
        reject(new Error('No audio data received'));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'en-US-GuyNeural', speed = 1.0 } = await req.json();

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

    const selectedVoice = VOICE_IDS.includes(voice) ? voice : 'en-US-GuyNeural';

    // Convert speed to rate string
    const ratePercent = Math.round((speed - 1) * 100);
    const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const audioBuffer = await synthesizeSpeech(trimmedText, selectedVoice, rateString);

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
