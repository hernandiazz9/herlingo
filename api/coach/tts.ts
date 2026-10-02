/**
 * POST /api/coach/tts/ { text, voice } → audio/mpeg. Fake mode returns a short silent mp3; the real
 * edge-tts voice arrives with T44 (until then 503, and the client falls back to the device voice).
 */
import { authenticate } from "../_lib/access";
import { isFake } from "../_lib/config";
import { CoachError, readBody, route } from "../_lib/http";
import { allowedVoices } from "../_lib/languages";
import { TtsRequest } from "../_lib/schema";
import { silentMp3 } from "../_lib/fake";

export default route({
  async POST(request) {
    authenticate(request);
    const { voice } = await readBody(request, TtsRequest);
    if (!allowedVoices().has(voice)) throw new CoachError(400, "bad_request", "Esa voz no está disponible.");
    if (!isFake()) throw new CoachError(503, "tts_unavailable", "La voz no está disponible ahora; uso la del dispositivo.");
    return new Response(silentMp3() as BodyInit, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  },
});
