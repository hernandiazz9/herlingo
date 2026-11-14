/**
 * POST /api/coach/tts/ { text, voice, slow? } → audio/mpeg read by a neural voice (edge-tts); with
 * `slow: true` the voice reads at rate −30 % (Modo deporte's slow lines). Fake mode
 * returns a short silent mp3 with no network; if the voice service fails → 503 and the client
 * falls back to the device voice. Every line read counts against the code's daily voice lines
 * (a line the voice could not read is given back).
 * The stress marks of a pack with a `stress` rule (the pack that declares the voice) are removed
 * before reading. Voices: those the content packs declare, the narrators and Mi entrevista's two
 * (`allowedVoices()`); any other → 400.
 */
import { authenticate } from "../_lib/access.js";
import { isFake } from "../_lib/config.js";
import { CoachError, readBody, route } from "../_lib/http.js";
import { allowedVoices, stripStressForVoice } from "../_lib/languages.js";
import { reserveTts } from "../_lib/ledger.js";
import { TtsRequest } from "../_lib/schema.js";
import { silentMp3 } from "../_lib/fake.js";
import { synthesize } from "../_lib/tts.js";

export default route({
  async POST(request) {
    const caller = authenticate(request);
    const body = await readBody(request, TtsRequest);
    const { voice } = body;
    if (!allowedVoices().has(voice)) throw new CoachError(400, "bad_request", "Esa voz no está disponible.");
    // Written stress marks are for the eyes: never read aloud (the client caches by the marked text).
    const text = stripStressForVoice(body.text, voice).trim();
    if (!text) throw new CoachError(400, "bad_request", "La petición no es válida.");
    const refund = await reserveTts(caller);
    let audio: Uint8Array;
    try {
      audio = isFake() ? silentMp3() : await synthesize(text, voice, { slow: body.slow === true });
    } catch (error) {
      await refund().catch(() => {});
      throw error;
    }
    return new Response(audio as BodyInit, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  },
});
