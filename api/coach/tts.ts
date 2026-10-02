/**
 * POST /api/coach/tts/ { text, voice } → audio/mpeg read by a neural voice (edge-tts). Fake mode
 * returns a short silent mp3 with no network; if the voice service fails → 503 and the client
 * falls back to the device voice.
 */
import { authenticate } from "../_lib/access";
import { isFake } from "../_lib/config";
import { CoachError, readBody, route } from "../_lib/http";
import { allowedVoices } from "../_lib/languages";
import { TtsRequest } from "../_lib/schema";
import { silentMp3 } from "../_lib/fake";
import { synthesize } from "../_lib/tts";

export default route({
  async POST(request) {
    authenticate(request);
    const { text, voice } = await readBody(request, TtsRequest);
    if (!allowedVoices().has(voice)) throw new CoachError(400, "bad_request", "Esa voz no está disponible.");
    const audio = isFake() ? silentMp3() : await synthesize(text, voice);
    return new Response(audio as BodyInit, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  },
});
