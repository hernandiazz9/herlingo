/**
 * Role-play of a pack's dialogue: the adapter to the content `Dialogue` the dialogue player takes,
 * and the XP for finishing it (like a game round; half on repeats of the same pack today, the
 * marker is `lang-lern:coach:practice:<lang>`).
 */
import type { Dialogue, DialogueTurn } from "@/lib/content";
import { roundXp } from "@/lib/game";
import { dayKey } from "@/lib/progress";
import { recordActivity } from "@/lib/progress/activity";
import { packLine } from "./audio";
import { COACH_KEYS, readRaw, readVersioned, writeJson } from "./store";
import type { CoachPack } from "./types";

const VERSION = 1;

/** The pack's dialogue as a content `Dialogue`, every line playable with the pack's voices. */
export function packDialogue(pack: CoachPack): Dialogue {
  const turns = pack.dialogue.turns.map((turn): DialogueTurn => {
    if (turn.speaker === "native") return { ...turn, ...packLine(pack, turn.text) };
    return { ...turn, options: turn.options.map((o) => ({ ...o, ...packLine(pack, o.text, "learner") })) };
  });
  return {
    id: pack.id,
    title: pack.dialogue.title,
    situation: "",
    order: 0,
    register: pack.register === "formal" ? "lei" : "tu",
    turns,
  };
}

/** Ids of the packs of `lang` whose role-play already earned XP today. */
function rewardedToday(lang: string): string[] {
  const v = readVersioned(readRaw(COACH_KEYS.practice(lang)), VERSION);
  if (v?.day !== dayKey() || !Array.isArray(v.packs)) return [];
  return v.packs.filter((id): id is string => typeof id === "string");
}

/**
 * Records a finished role-play with `correct` right answers: the XP of a game round, half when
 * this pack already earned XP today. Returns the XP awarded and whether it was a repeat.
 */
export function awardPracticeXp(pack: CoachPack, correct: number): { xp: number; repeat: boolean } {
  const done = rewardedToday(pack.lang);
  const repeat = done.includes(pack.id);
  const xp = repeat ? Math.ceil(roundXp(correct) / 2) : roundXp(correct);
  if (!repeat) writeJson(COACH_KEYS.practice(pack.lang), { v: VERSION, day: dayKey(), packs: [...done, pack.id] });
  recordActivity({ lang: pack.lang, xp, outcomes: [], source: "coach" });
  return { xp, repeat };
}
