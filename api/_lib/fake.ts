/**
 * Fake mode (`COACH_FAKE=1`, or no Anthropic key in local dev): canned answers, no network.
 * Fixtures are test data keyed by language; a language without one gets placeholder lines.
 */
import type { LanguageMeta } from "./languages";
import type { TokenUsage } from "./model";
import type { Assessment, GeneratedPack, InterviewQuestion, InterviewStep } from "./schema";

/** Plausible token counts of a real call, so the ledger and the usage panel show real-looking numbers. */
export const FAKE_PACK_USAGE: TokenUsage = { input: 1400, output: 2600, cacheWrite: 0, cacheRead: 2100 };
export const FAKE_INTERVIEW_USAGE: TokenUsage = { input: 900, output: 350, cacheWrite: 0, cacheRead: 1800 };

const IT_PACK: GeneratedPack = {
  title: "Pedir un granizado en el bar",
  register: "formal",
  guide: [
    { es: "Entra y saluda al camarero con un «buongiorno» aunque haya cola." },
    { es: "En muchos bares de Sicilia se paga primero en la caja: pide el ticket (lo scontrino)." },
    { es: "Di el sabor que quieres y si lo quieres con brioche." },
    { es: "Si no entiendes, pide que te lo repita más despacio." },
    { es: "Al terminar, da las gracias y despídete." },
  ],
  keyPhrases: [
    { text: "Buongiorno, vorrei una granita, per favore.", es: "Buenos días, querría un granizado, por favor." },
    { text: "Che gusti avete?", es: "¿Qué sabores tenéis?" },
    { text: "Alla mandorla, con la brioche.", es: "De almendra, con brioche." },
    { text: "Quanto costa?", es: "¿Cuánto cuesta?" },
    { text: "Pago qui o alla cassa?", es: "¿Pago aquí o en la caja?" },
    { text: "Posso pagare con la carta?", es: "¿Puedo pagar con tarjeta?" },
    { text: "Può ripetere più lentamente?", es: "¿Puede repetir más despacio?", note: "Lei: formal, para el camarero." },
    { text: "Da portare via, grazie.", es: "Para llevar, gracias." },
    { text: "Me la mette in un bicchiere?", es: "¿Me lo pone en un vaso?" },
    { text: "Grazie, buona giornata!", es: "¡Gracias, que tenga buen día!" },
  ],
  dialogue: {
    title: "Una granita a Catania",
    turns: [
      { speaker: "native", name: "Barista", text: "Buongiorno! Cosa le preparo?", es: "¡Buenos días! ¿Qué le preparo?" },
      {
        speaker: "learner",
        prompt: "Pide un granizado de almendra con brioche.",
        options: [
          {
            text: "Vorrei una granita alla mandorla con la brioche, per favore.",
            es: "Querría un granizado de almendra con brioche, por favor.",
            verdict: "correct",
            feedback: "¡Perfecto! «Vorrei» es la forma educada de pedir.",
          },
          {
            text: "Una granita mandorla e brioche.",
            es: "Un granizado almendra y brioche.",
            verdict: "acceptable",
            feedback: "Se entiende, pero falta «alla» y un «per favore».",
          },
          {
            text: "Voglio la granita!",
            es: "¡Quiero el granizado!",
            verdict: "wrong",
            feedback: "«Voglio» suena brusco con un desconocido: mejor «vorrei».",
          },
        ],
      },
      { speaker: "native", name: "Barista", text: "Certo. Grande o piccola?", es: "Claro. ¿Grande o pequeño?" },
      {
        speaker: "learner",
        prompt: "Dile que pequeño y pregunta cuánto es.",
        options: [
          {
            text: "Piccola, grazie. Quanto costa?",
            es: "Pequeño, gracias. ¿Cuánto cuesta?",
            verdict: "correct",
            feedback: "¡Bien! Corto y natural.",
          },
          {
            text: "Piccolo. Quanto?",
            es: "Pequeño. ¿Cuánto?",
            verdict: "acceptable",
            feedback: "Se entiende; «granita» es femenino: «piccola».",
          },
        ],
      },
      { speaker: "native", name: "Barista", text: "Tre euro e cinquanta. Paga alla cassa.", es: "Tres euros con cincuenta. Pague en la caja." },
      {
        speaker: "learner",
        prompt: "Pregunta si puedes pagar con tarjeta.",
        options: [
          {
            text: "Posso pagare con la carta?",
            es: "¿Puedo pagar con tarjeta?",
            verdict: "correct",
            feedback: "¡Exacto!",
          },
          {
            text: "Pago con il carta?",
            es: "¿Pago con tarjeta?",
            verdict: "wrong",
            feedback: "«Carta» es femenino: «con la carta».",
          },
        ],
      },
      { speaker: "native", name: "Barista", text: "Sì, certo. Ecco la sua granita!", es: "Sí, claro. ¡Aquí tiene su granizado!" },
      {
        speaker: "learner",
        prompt: "Da las gracias y despídete.",
        options: [
          {
            text: "Grazie mille, buona giornata!",
            es: "¡Muchas gracias, buen día!",
            verdict: "correct",
            feedback: "¡Genial! Así se despide uno en el bar.",
          },
          { text: "Ciao ciao!", es: "¡Chao!", verdict: "acceptable", feedback: "Vale, aunque con el camarero queda mejor «buona giornata»." },
        ],
      },
    ],
  },
};

const IT_QUESTIONS: InterviewQuestion[] = [
  { kind: "comprehension", prompt: "Escucha y di qué te preguntan.", text: "Di dove sei?" },
  { kind: "reply", prompt: "El revisor te dice esto. ¿Qué le contestas?", text: "Biglietto, prego." },
  { kind: "personal", prompt: "Cuéntame en italiano (o en español) qué vas a hacer en tu viaje." },
];

const IT_ASSESSMENT: Assessment = {
  level: "A1",
  summary: "Entiendes preguntas cortas y frecuentes y respondes con frases sencillas. Te falta soltura con los verbos.",
  strengths: ["Saludos y cortesía", "Preguntas sobre el origen"],
  weakPoints: ["Conjugar verbos en presente", "Entender respuestas rápidas"],
  facts: ["Viaja a Sicilia en tren y autobús"],
};

function placeholderPack(meta: LanguageMeta, description: string): GeneratedPack {
  const say = (n: number) => `[${meta.lang}] ${n}`;
  return {
    title: description.slice(0, 80),
    register: "formal",
    guide: [{ es: "Paso uno." }, { es: "Paso dos." }, { es: "Paso tres." }],
    keyPhrases: Array.from({ length: 8 }, (_, i) => ({ text: say(i + 1), es: `Frase ${i + 1}` })),
    dialogue: {
      title: description.slice(0, 80),
      turns: Array.from({ length: 6 }, (_, i) =>
        i % 2 === 0
          ? { speaker: "native" as const, text: say(i + 1), es: `Turno ${i + 1}` }
          : {
              speaker: "learner" as const,
              prompt: `Responde (${i + 1}).`,
              options: [
                { text: say(i + 1), es: "Bien", verdict: "correct" as const, feedback: "¡Bien!" },
                { text: say(i + 2), es: "Mal", verdict: "wrong" as const, feedback: "Casi." },
              ],
            },
      ),
    },
  };
}

export function fakePack(meta: LanguageMeta, description: string, refinement?: string): GeneratedPack {
  const pack = meta.lang === "it" ? structuredClone(IT_PACK) : placeholderPack(meta, description);
  if (refinement !== undefined) pack.title = `${pack.title} (${refinement || "otra versión"})`.slice(0, 80);
  return pack;
}

export function fakeInterviewStep(meta: LanguageMeta, answered: number): InterviewStep {
  const questions =
    meta.lang === "it"
      ? IT_QUESTIONS
      : IT_QUESTIONS.map((q) => ({ ...q, text: q.text && `[${meta.lang}] ${q.text}` }));
  if (answered < questions.length) return { done: false, question: questions[answered] };
  return { done: true, assessment: IT_ASSESSMENT };
}

/**
 * A short silent mp3 (MPEG-1 Layer III, 128 kbps, 44.1 kHz, mono, ~0.26 s): ten frames whose
 * header is followed by zeroed side info and data, which decoders play as silence.
 */
export function silentMp3(): Uint8Array {
  const frameLength = 417; // 144 × 128000 / 44100
  const frames = 10;
  const out = new Uint8Array(frameLength * frames);
  for (let i = 0; i < frames; i++) out.set([0xff, 0xfb, 0x90, 0xc4], i * frameLength);
  return out;
}
