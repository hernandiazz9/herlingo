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

const FR_PACK: GeneratedPack = {
  title: "Pedir un café en una terraza",
  register: "formal",
  guide: [
    { es: "Saluda al camarero con un «bonjour» antes de pedir nada: es casi obligatorio." },
    { es: "Pide con «je voudrais» o «s'il vous plaît», tratándolo de usted (vous)." },
    { es: "Un «café» es un expreso; si lo quieres con leche, pide un «café crème»." },
    { es: "Para pagar, pide la cuenta: «l'addition, s'il vous plaît»." },
    { es: "Al irte, despídete con un «merci, bonne journée»." },
  ],
  keyPhrases: [
    { text: "Bonjour, je voudrais un café, s'il vous plaît.", es: "Buenos días, querría un café, por favor." },
    { text: "Un café crème, s'il vous plaît.", es: "Un café con leche, por favor." },
    { text: "Vous avez des croissants ?", es: "¿Tienen cruasanes?" },
    { text: "C'est combien ?", es: "¿Cuánto es?" },
    { text: "L'addition, s'il vous plaît.", es: "La cuenta, por favor." },
    { text: "Je peux payer par carte ?", es: "¿Puedo pagar con tarjeta?" },
    { text: "Vous pouvez répéter plus lentement ?", es: "¿Puede repetir más despacio?", note: "Vous: formal, para el camarero." },
    { text: "Merci, bonne journée !", es: "¡Gracias, que tenga buen día!" },
  ],
  dialogue: {
    title: "Un café à Paris",
    turns: [
      { speaker: "native", name: "Serveur", text: "Bonjour ! Qu'est-ce que je vous sers ?", es: "¡Buenos días! ¿Qué le sirvo?" },
      {
        speaker: "learner",
        prompt: "Pide un café con leche y un cruasán.",
        options: [
          {
            text: "Je voudrais un café crème et un croissant, s'il vous plaît.",
            es: "Querría un café con leche y un cruasán, por favor.",
            verdict: "correct",
            feedback: "¡Perfecto! «Je voudrais» es la forma educada de pedir.",
          },
          {
            text: "Un café crème et un croissant.",
            es: "Un café con leche y un cruasán.",
            verdict: "acceptable",
            feedback: "Se entiende, pero falta un «s'il vous plaît».",
          },
          {
            text: "Je veux un café !",
            es: "¡Quiero un café!",
            verdict: "wrong",
            feedback: "«Je veux» suena brusco con un desconocido: mejor «je voudrais».",
          },
        ],
      },
      { speaker: "native", name: "Serveur", text: "Très bien. Autre chose ?", es: "Muy bien. ¿Algo más?" },
      {
        speaker: "learner",
        prompt: "Di que no, gracias, y pregunta cuánto es.",
        options: [
          { text: "Non, merci. C'est combien ?", es: "No, gracias. ¿Cuánto es?", verdict: "correct", feedback: "¡Bien! Corto y natural." },
          { text: "Non. Combien ?", es: "No. ¿Cuánto?", verdict: "acceptable", feedback: "Se entiende; con un «merci» queda mejor." },
        ],
      },
      { speaker: "native", name: "Serveur", text: "Six euros cinquante.", es: "Seis euros con cincuenta." },
      {
        speaker: "learner",
        prompt: "Pregunta si puedes pagar con tarjeta.",
        options: [
          { text: "Je peux payer par carte ?", es: "¿Puedo pagar con tarjeta?", verdict: "correct", feedback: "¡Exacto!" },
          { text: "Je paye avec la carte ?", es: "¿Pago con la tarjeta?", verdict: "acceptable", feedback: "Se entiende; lo habitual es «par carte»." },
        ],
      },
      { speaker: "native", name: "Serveur", text: "Bien sûr. Voilà !", es: "Claro. ¡Aquí tiene!" },
      {
        speaker: "learner",
        prompt: "Da las gracias y despídete.",
        options: [
          { text: "Merci, bonne journée !", es: "¡Gracias, buen día!", verdict: "correct", feedback: "¡Genial! Así se despide uno." },
          { text: "Salut !", es: "¡Chao!", verdict: "acceptable", feedback: "Vale, aunque con el camarero queda mejor «bonne journée»." },
        ],
      },
    ],
  },
};

interface Fixture {
  pack: GeneratedPack;
  /** Interview questions before the personal one (that one names the language, see `questionsFor`). */
  questions: InterviewQuestion[];
  assessment: Assessment;
}

/** Test data per language; a language without a fixture gets placeholder lines. */
const FIXTURES: Record<string, Fixture> = {
  it: {
    pack: IT_PACK,
    questions: [
      { kind: "comprehension", prompt: "Escucha y di qué te preguntan.", text: "Di dove sei?" },
      { kind: "reply", prompt: "El revisor te dice esto. ¿Qué le contestas?", text: "Biglietto, prego." },
    ],
    assessment: {
      level: "A1",
      summary: "Entiendes preguntas cortas y frecuentes y respondes con frases sencillas. Te falta soltura con los verbos.",
      strengths: ["Saludos y cortesía", "Preguntas sobre el origen"],
      weakPoints: ["Conjugar verbos en presente", "Entender respuestas rápidas"],
      facts: ["Viaja a Sicilia en tren y autobús"],
    },
  },
  fr: {
    pack: FR_PACK,
    questions: [
      { kind: "comprehension", prompt: "Escucha y di qué te preguntan.", text: "Vous venez d'où ?" },
      { kind: "reply", prompt: "El camarero te dice esto. ¿Qué le contestas?", text: "Vous désirez ?" },
    ],
    assessment: {
      level: "A0",
      summary: "Reconoces saludos y preguntas muy frecuentes. Te falta vocabulario básico y soltura al responder.",
      strengths: ["Saludos y cortesía"],
      weakPoints: ["Pronunciación de las vocales nasales", "Entender respuestas rápidas"],
      facts: ["Viaja a Francia"],
    },
  },
};

const PLACEHOLDER_ASSESSMENT: Assessment = {
  level: "A1",
  summary: "Entiendes preguntas cortas y respondes con frases sencillas.",
  strengths: ["Saludos y cortesía"],
  weakPoints: ["Entender respuestas rápidas"],
  facts: [],
};

function questionsFor(meta: LanguageMeta): InterviewQuestion[] {
  const fixed = FIXTURES[meta.lang]?.questions ?? [
    { kind: "comprehension", prompt: "Escucha y di qué te preguntan.", text: `[${meta.lang}] 1` },
    { kind: "reply", prompt: "Te dicen esto. ¿Qué contestas?", text: `[${meta.lang}] 2` },
  ];
  const name = meta.name.toLocaleLowerCase("es");
  return [...fixed, { kind: "personal", prompt: `Cuéntame en ${name} (o en español) qué vas a hacer en tu viaje.` }];
}

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
  const fixture = FIXTURES[meta.lang];
  const pack = fixture ? structuredClone(fixture.pack) : placeholderPack(meta, description);
  if (refinement !== undefined) pack.title = `${pack.title} (${refinement || "otra versión"})`.slice(0, 80);
  return pack;
}

export function fakeInterviewStep(meta: LanguageMeta, answered: number): InterviewStep {
  const questions = questionsFor(meta);
  if (answered < questions.length) return { done: false, question: questions[answered] };
  return { done: true, assessment: FIXTURES[meta.lang]?.assessment ?? PLACEHOLDER_ASSESSMENT };
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
