/**
 * Voice rotation (pack.json `voiceRotation`): a playable whose content names no `voice` gets a
 * deterministic voice from the pack's `voices`, chosen by a stable hash of an id, so the same
 * content always gets the same voice and `npm run audio` never regenerates mp3s that did not
 * change. Pure and dependency-free (used by `build.ts`).
 */

/** 32-bit hash of a string (FNV-1a plus a murmur-style finaliser, so near-identical ids spread out). */
export function voiceHash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The voice `key` maps to. */
export function rotatedVoice(voices: readonly string[], key: string): string {
  return voices[voiceHash(key) % voices.length];
}

/** A voice for `key` that is not `avoid` (the only voice when the pack has just one). */
export function otherVoice(voices: readonly string[], avoid: string, key: string): string {
  const rest = voices.filter((v) => v !== avoid);
  return rest.length ? rest[voiceHash(key) % rest.length] : avoid;
}

/**
 * One voice per speaker of a dialogue. `speakers` are the native speakers in order of first
 * appearance (`name` is "" for an unnamed one); `explicit` is the voice the content already gives
 * that speaker, if any, and always wins. The others get the voice their name hashes to, moving on
 * to the next voice when another speaker of the dialogue already has it, so two speakers differ
 * for as long as the pack has voices left.
 */
export function speakerVoices(
  voices: readonly string[],
  dialogueId: string,
  speakers: readonly { name: string; explicit?: string }[],
): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const s of speakers) {
    if (s.explicit) {
      out.set(s.name, s.explicit);
      used.add(s.explicit);
    }
  }
  for (const s of speakers) {
    if (s.explicit) continue;
    const start = voiceHash(`${dialogueId}|${s.name}`) % voices.length;
    let voice = voices[start];
    for (let i = 0; i < voices.length; i++) {
      const candidate = voices[(start + i) % voices.length];
      if (!used.has(candidate)) {
        voice = candidate;
        break;
      }
    }
    out.set(s.name, voice);
    used.add(voice);
  }
  return out;
}
