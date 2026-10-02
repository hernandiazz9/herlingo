/**
 * Neural voice for the coach: Microsoft Edge's read-aloud service (edge-tts, no key) through the
 * `msedge-tts` package, with the same output and prosody as `npm run audio` (Python edge-tts
 * defaults). One WebSocket per request, a timeout per attempt, one retry; then 503 and the client
 * falls back to the device voice.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { CoachError } from "./http";

const ATTEMPTS = 2;
const TIMEOUT_MS = 10_000;
const PROSODY = { rate: "+0%", pitch: "+0Hz", volume: "+0%" };

/** SSML text content, as Python edge-tts builds it: control characters → spaces, `& < >` escaped. */
function ssmlText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function read(tts: MsEdgeTTS, text: string, voice: string): Promise<Uint8Array> {
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(ssmlText(text), PROSODY);
  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) chunks.push(chunk as Buffer);
  const audio = Buffer.concat(chunks);
  if (audio.length === 0) throw new Error("empty audio");
  return audio;
}

async function attempt(text: string, voice: string): Promise<Uint8Array> {
  const tts = new MsEdgeTTS();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
  });
  try {
    return await Promise.race([read(tts, text, voice), timeout]);
  } finally {
    clearTimeout(timer);
    tts.close();
  }
}

/** mp3 (24 kHz, 48 kbps, mono) of `text` read by `voice`; 503 `tts_unavailable` if the service fails. */
export async function synthesize(text: string, voice: string): Promise<Uint8Array> {
  let last: unknown;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      return await attempt(text, voice);
    } catch (error) {
      last = error;
    }
  }
  console.error("[coach] edge-tts failed", voice, last instanceof Error ? last.message : last);
  throw new CoachError(503, "tts_unavailable", "La voz no está disponible ahora; uso la del dispositivo.");
}
