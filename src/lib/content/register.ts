/**
 * Register badges ("Trato de tú", "Trato de usted (Lei)"…), from data maps keyed by the pack's
 * `formalRegister`: no pack id in code. Spain Spanish UI copy.
 */

/** Pronoun shown after "Trato de usted" for a Latin-script formal register; others show none. */
const FORMAL_PRONOUN: Record<string, string> = { lei: "Lei", vous: "Vous", u: "u" };

/** Informal pronoun of a pack whose `tu` register is not "tú" (Spanish with `usted`: voseo, "vos"). */
const INFORMAL_PRONOUN: Record<string, string> = { usted: "vos" };

/** "Trato de tú", or "Trato de vos" for a pack whose informal pronoun differs (`INFORMAL_PRONOUN`). */
export function informalLabel(formalRegister: string): string {
  return `Trato de ${INFORMAL_PRONOUN[formalRegister] ?? "tú"}`;
}

/**
 * Badge of an item or dialogue register: "Trato de tú" / "Trato de vos", or "Trato de usted (Lei)" /
 * "(Vous)" / "(u)" / "Trato de usted" (`vy`, `usted`) for the pack's formal register; a pack whose
 * formal register is the generic `formal` (no polite pronoun) says "Registro informal" /
 * "Registro formal"; neutral = none ("").
 */
export function registerLabel(register: string, formalRegister: string): string {
  if (register === "neutral") return "";
  if (formalRegister === "formal") return register === "tu" ? "Registro informal" : "Registro formal";
  if (register === "tu") return informalLabel(formalRegister);
  const pronoun = FORMAL_PRONOUN[register];
  return pronoun ? `Trato de usted (${pronoun})` : "Trato de usted";
}
