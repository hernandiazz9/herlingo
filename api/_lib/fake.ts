/**
 * Fake mode (`COACH_FAKE=1`, or no Anthropic key in local dev): canned answers, no network.
 * Fixtures are test data keyed by language; a language without one gets placeholder lines (with
 * stress marks when its pack has a `stress` rule).
 */
import type { LanguageMeta } from "./languages.js";
import type { TokenUsage } from "./model.js";
import type {
  Assessment,
  GeneratedEpisode,
  GeneratedPack,
  GeneratedRoute,
  InterviewDeck,
  InterviewQuestion,
  InterviewStep,
} from "./schema.js";

/** Plausible token counts of a real call, so the ledger and the usage panel show real-looking numbers. */
export const FAKE_PACK_USAGE: TokenUsage = { input: 1400, output: 2600, cacheWrite: 0, cacheRead: 2100 };
export const FAKE_INTERVIEW_USAGE: TokenUsage = { input: 900, output: 350, cacheWrite: 0, cacheRead: 1800 };
/** A route: the first call in 5 minutes (prefix written to the cache), docs/coach.md "Modo rápido". */
export const FAKE_ROUTE_USAGE: TokenUsage = { input: 500, output: 1700, cacheWrite: 2500, cacheRead: 0 };
/** A Modo deporte episode: the first call in 5 minutes, docs/sport.md "Model". */
export const FAKE_EPISODE_USAGE: TokenUsage = { input: 500, output: 5000, cacheWrite: 3000, cacheRead: 0 };

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

const IT_ROUTE: GeneratedRoute = {
  title: "Imprimir un documento desde el móvil",
  register: "formal",
  turns: [
    {
      speaker: "learner",
      text: "Buongiorno, devo stampare un documento dal telefono.",
      es: "Buenos días, tengo que imprimir un documento desde el móvil.",
      alts: [
        { text: "Salve, posso stampare una cosa dal cellulare?", es: "Hola, ¿puedo imprimir una cosa desde el móvil?" },
        { text: "Buongiorno, fate stampe dal telefono?", es: "Buenos días, ¿hacéis impresiones desde el móvil?" },
      ],
      words: [
        { text: "devo stampare", es: "tengo que imprimir" },
        { text: "dal telefono", es: "desde el móvil" },
        { text: "cellulare", es: "móvil" },
      ],
    },
    {
      speaker: "native",
      text: "Certo. Me lo manda per email o su WhatsApp?",
      es: "Claro. ¿Me lo manda por correo o por WhatsApp?",
      alts: [
        { text: "Ce l'ha su una chiavetta?", es: "¿Lo tiene en un pendrive?" },
        { text: "Lo mandi a questo indirizzo.", es: "Mándelo a esta dirección." },
      ],
      words: [
        { text: "me lo manda", es: "me lo envía" },
        { text: "per email", es: "por correo electrónico" },
        { text: "chiavetta", es: "pendrive" },
      ],
    },
    {
      speaker: "learner",
      text: "Per email. Qual è l'indirizzo?",
      es: "Por correo. ¿Cuál es la dirección?",
      alts: [
        { text: "Su WhatsApp, va bene?", es: "Por WhatsApp, ¿vale?" },
        { text: "Ce l'ho su una chiavetta.", es: "Lo tengo en un pendrive." },
      ],
      words: [
        { text: "qual è", es: "cuál es" },
        { text: "l'indirizzo", es: "la dirección" },
        { text: "ce l'ho", es: "lo tengo" },
      ],
    },
    {
      speaker: "native",
      text: "È questo qui. A colori o in bianco e nero?",
      es: "Es esta de aquí. ¿En color o en blanco y negro?",
      alts: [
        { text: "Lo vuole a colori?", es: "¿Lo quiere en color?" },
        { text: "Fronte e retro o solo fronte?", es: "¿A doble cara o solo por una cara?" },
      ],
      words: [
        { text: "a colori", es: "en color" },
        { text: "in bianco e nero", es: "en blanco y negro" },
        { text: "fronte e retro", es: "a doble cara" },
      ],
    },
    {
      speaker: "learner",
      text: "In bianco e nero, per favore.",
      es: "En blanco y negro, por favor.",
      alts: [
        { text: "A colori, per favore.", es: "En color, por favor." },
        { text: "Quanto costa a colori?", es: "¿Cuánto cuesta en color?" },
      ],
      words: [
        { text: "in bianco e nero", es: "en blanco y negro" },
        { text: "a colori", es: "en color" },
        { text: "quanto costa", es: "cuánto cuesta" },
      ],
    },
    {
      speaker: "native",
      text: "Quante copie? In A4 va bene?",
      es: "¿Cuántas copias? ¿En A4 le va bien?",
      alts: [
        { text: "Quante copie le servono?", es: "¿Cuántas copias necesita?" },
        { text: "Tutte le pagine?", es: "¿Todas las páginas?" },
      ],
      words: [
        { text: "quante copie", es: "cuántas copias" },
        { text: "le servono", es: "necesita" },
        { text: "tutte le pagine", es: "todas las páginas" },
      ],
    },
    {
      speaker: "learner",
      text: "Due copie in A4. Quant'è?",
      es: "Dos copias en A4. ¿Cuánto es?",
      alts: [
        { text: "Una copia sola, grazie.", es: "Solo una copia, gracias." },
        { text: "Solo la prima pagina.", es: "Solo la primera página." },
      ],
      words: [
        { text: "due copie", es: "dos copias" },
        { text: "quant'è", es: "cuánto es" },
        { text: "una copia sola", es: "solo una copia" },
      ],
    },
    {
      speaker: "native",
      text: "Sono sessanta centesimi. Contanti o carta?",
      es: "Son sesenta céntimos. ¿Efectivo o tarjeta?",
      alts: [
        { text: "Fanno sessanta centesimi.", es: "Son sesenta céntimos." },
        { text: "Si paga alla cassa.", es: "Se paga en la caja." },
      ],
      words: [
        { text: "sessanta centesimi", es: "sesenta céntimos" },
        { text: "contanti", es: "efectivo" },
        { text: "carta", es: "tarjeta" },
      ],
    },
  ],
};

const IT_EPISODE: GeneratedEpisode = {
  title: "Hacer la compra en el supermercado",
  register: "formal",
  intro:
    "Vas a hacer la compra en un supermercado: pesas la fruta, buscas la harina, pides embutido en el mostrador y pagas en la caja.",
  parts: [
    {
      title: "Primera parte: la fruta y la harina.",
      steps: [
        {
          speaker: "learner",
          intro: "En la fruta ves una báscula. Quieres saber si la fruta la pesas tú. Preguntas:",
          line: { text: "Scusi, la frutta la peso io?", es: "Perdone, ¿la fruta la peso yo?" },
          variants: [{ cue: "Los guantes:", text: "Scusi, dove sono i guanti?", es: "Perdone, ¿dónde están los guantes?" }],
        },
        {
          speaker: "native",
          intro: "Un dependiente te contesta:",
          line: { text: "Sì, usi la bilancia e metta l'etichetta sul sacchetto.", es: "Sí, use la báscula y ponga la etiqueta en la bolsa." },
          variants: [{ cue: "O también te pueden decir:", text: "La bilancia è lì, in fondo.", es: "La báscula está allí, al fondo." }],
          tip: "Para tocar la fruta, usa los guantes de plástico que suele haber al lado.",
        },
        {
          speaker: "learner",
          intro: "Ahora buscas la harina. Le preguntas al dependiente:",
          line: { text: "Scusi, dov'è la farina?", es: "Perdone, ¿dónde está la harina?" },
          variants: [
            { cue: "El azúcar:", text: "Scusi, dov'è lo zucchero?", es: "Perdone, ¿dónde está el azúcar?" },
            { cue: "La leche:", text: "Scusi, dov'è il latte?", es: "Perdone, ¿dónde está la leche?" },
          ],
        },
      ],
    },
    {
      title: "Segunda parte: el mostrador de embutidos.",
      steps: [
        {
          speaker: "native",
          intro: "En el mostrador de embutidos, cuando sale tu número, te dicen:",
          line: { text: "Prego, cosa le do?", es: "Dígame, ¿qué le pongo?" },
          variants: [{ cue: "O también te pueden decir:", text: "Il prossimo! Cosa desidera?", es: "¡El siguiente! ¿Qué desea?" }],
          tip: "Antes de pedir, coge un número en la máquina y espera tu turno.",
        },
        {
          speaker: "learner",
          intro: "Quieres doscientos gramos de jamón cocido. Dices:",
          line: { text: "Due etti di prosciutto cotto, per favore.", es: "Doscientos gramos de jamón cocido, por favor." },
          variants: [
            { cue: "Cien gramos de jamón curado:", text: "Un etto di prosciutto crudo, per favore.", es: "Cien gramos de jamón curado, por favor." },
          ],
          tip: "Un etto son cien gramos: así se pide el embutido.",
        },
        {
          speaker: "native",
          intro: "Te da el paquete y te pregunta:",
          line: { text: "Ecco a lei. Altro?", es: "Aquí tiene. ¿Algo más?" },
          variants: [
            { cue: "O también te pueden decir:", text: "Le serve altro?", es: "¿Necesita algo más?" },
            { cue: "O también te pueden decir:", text: "Basta così?", es: "¿Es todo?" },
          ],
        },
      ],
    },
    {
      title: "Tercera parte: la caja.",
      steps: [
        {
          speaker: "native",
          intro: "En la caja, la cajera te pregunta:",
          line: { text: "Buongiorno, ha la carta fedeltà?", es: "Buenos días, ¿tiene la tarjeta de cliente?" },
          variants: [{ cue: "O también te pueden decir:", text: "Ha la tessera del supermercato?", es: "¿Tiene la tarjeta del supermercado?" }],
          tip: "Es la tarjeta de puntos del supermercado. Si no la tienes, basta con decir que no.",
        },
        {
          speaker: "learner",
          intro: "No la tienes y quieres una bolsa. Dices:",
          line: { text: "No, grazie. Mi dà anche una busta?", es: "No, gracias. ¿Me da también una bolsa?" },
          variants: [{ cue: "Para pagar con tarjeta:", text: "No, grazie. Posso pagare con la carta?", es: "No, gracias. ¿Puedo pagar con tarjeta?" }],
          tip: "Las bolsas se pagan aparte y suelen costar unos céntimos.",
        },
      ],
    },
  ],
};

interface Fixture {
  pack: GeneratedPack;
  /** Quick route (Modo rápido); a language without one gets placeholder lines. */
  route?: GeneratedRoute;
  /** Modo deporte episode; a language without one gets placeholder lines. */
  episode?: GeneratedEpisode;
  /** Interview questions before the personal one (that one names the language, see `questionsFor`). */
  questions: InterviewQuestion[];
  assessment: Assessment;
}

/** Test data per language; a language without a fixture gets placeholder lines. */
const FIXTURES: Record<string, Fixture> = {
  it: {
    pack: IT_PACK,
    route: IT_ROUTE,
    episode: IT_EPISODE,
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

/**
 * Placeholder line `n` of a language without a fixture. For a pack with a `stress` rule it also
 * carries two words built from the pack's own vowels, each with its stress mark (as a real
 * generation would), so the marks, their display and their stripping before TTS can be tried
 * in fake mode without any language-specific data in code.
 */
function placeholderLine(meta: LanguageMeta, n: number): string {
  const base = `[${meta.lang}] ${n}`;
  const rule = meta.stress;
  if (!rule) return base;
  const self = new Set(rule.selfStressed ?? "");
  const vowels = [...rule.vowels].filter((v) => !self.has(v));
  if (vowels.length < 2) return base;
  const word = (length: number, offset: number, stressed: number) =>
    Array.from({ length }, (_, i) => vowels[(offset + i) % vowels.length] + (i === stressed ? rule.mark : "")).join("");
  return `${base} ${word(2, n, n % 2)} ${word(3, n + 1, n % 3)}`;
}

function questionsFor(meta: LanguageMeta): InterviewQuestion[] {
  const fixed = FIXTURES[meta.lang]?.questions ?? [
    { kind: "comprehension", prompt: "Escucha y di qué te preguntan.", text: placeholderLine(meta, 1) },
    { kind: "reply", prompt: "Te dicen esto. ¿Qué contestas?", text: placeholderLine(meta, 2) },
  ];
  const name = meta.name.toLocaleLowerCase("es");
  return [...fixed, { kind: "personal", prompt: `Cuéntame en ${name} (o en español) qué vas a hacer en tu viaje.` }];
}

function placeholderPack(meta: LanguageMeta, description: string): GeneratedPack {
  const say = (n: number) => placeholderLine(meta, n);
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

function placeholderRoute(meta: LanguageMeta, description: string): GeneratedRoute {
  const say = (n: number) => placeholderLine(meta, n);
  return {
    title: description.slice(0, 60),
    register: "formal",
    turns: Array.from({ length: 6 }, (_, i) => ({
      speaker: i % 2 === 0 ? ("learner" as const) : ("native" as const),
      text: say(i + 1),
      es: `Línea ${i + 1}`,
      alts: [{ text: say(i + 11), es: `Otra forma ${i + 1}` }],
      words: [{ text: say(i + 21), es: `Palabra ${i + 1}` }],
    })),
  };
}

export function fakeRoute(meta: LanguageMeta, description: string): GeneratedRoute {
  const route = FIXTURES[meta.lang]?.route;
  return route ? structuredClone(route) : placeholderRoute(meta, description);
}

const PART_TITLES = ["Primera parte.", "Segunda parte.", "Tercera parte."];

/** 3 parts of 2 steps, learner and native in turn, each step with one variant and every other one a tip. */
function placeholderEpisode(meta: LanguageMeta, description: string): GeneratedEpisode {
  const say = (n: number) => placeholderLine(meta, n);
  return {
    title: description.slice(0, 60),
    register: "formal",
    intro: "Episodio de prueba.",
    parts: PART_TITLES.map((title, p) => ({
      title,
      steps: [0, 1].map((s) => {
        const n = p * 2 + s + 1;
        const learner = s === 0;
        return {
          speaker: learner ? ("learner" as const) : ("native" as const),
          intro: learner ? `Paso ${n}. Dices:` : `Paso ${n}. Te dicen:`,
          line: { text: say(n), es: `Línea ${n}.` },
          variants: [{ cue: learner ? "O también:" : "O también te pueden decir:", text: say(n + 10), es: `Otra forma ${n}.` }],
          ...(n % 2 ? { tip: `Consejo ${n}.` } : {}),
        };
      }),
    })),
  };
}

export function fakeEpisode(meta: LanguageMeta, description: string): GeneratedEpisode {
  const episode = FIXTURES[meta.lang]?.episode;
  return episode ? structuredClone(episode) : placeholderEpisode(meta, description);
}

export function fakeInterviewStep(meta: LanguageMeta, answered: number): InterviewStep {
  const questions = questionsFor(meta);
  if (answered < questions.length) return { done: false, question: questions[answered] };
  return { done: true, assessment: FIXTURES[meta.lang]?.assessment ?? PLACEHOLDER_ASSESSMENT };
}

/**
 * Mi entrevista's deck in fake mode (docs/mock-interview.md "Deck"): an invented, generic persona (a
 * QA analyst at a made-up company), 2 blocks × 3 cards, one card per block with `pending`. Never
 * anyone's real cards: the real deck lives only in Upstash and on the owner's device.
 */
const FAKE_DECK: InterviewDeck = {
  version: 1,
  generated: "2026-11-14",
  learner: "A Spanish-speaking QA analyst with four years of experience; B2 English.",
  blocks: [
    { id: "start", title: "Para empezar", intro: "Las preguntas con las que suele abrirse una entrevista." },
    { id: "star", title: "Situaciones (STAR)", intro: "Un caso real: situación, tarea, acción y resultado." },
  ],
  cards: [
    {
      id: "start-overview",
      block: "start",
      title: "Tu trayectoria",
      question: "Could you give me a quick overview of your background?",
      variants: ["Walk me through your career so far.", "How did you end up working in quality assurance?"],
      answer: [
        {
          en: "I'm a QA analyst, and I've spent the last four years testing web and mobile apps.",
          es: "Soy analista de QA y llevo cuatro años probando apps web y móviles.",
        },
        {
          en: "At Larkspur Freight, a small logistics company, I looked after the regression suite for the booking app.",
          es: "En Larkspur Freight, una pequeña empresa de logística, me ocupaba de la batería de regresión de la app de reservas.",
        },
        {
          en: "Before that, I worked on a hotel front desk, which taught me to stay calm with unhappy customers.",
          es: "Antes trabajé en la recepción de un hotel, donde aprendí a mantener la calma con clientes descontentos.",
        },
        { en: "Now I'd like to move into test automation.", es: "Ahora me gustaría pasar a la automatización de pruebas." },
      ],
      anchors: ["QA analyst", "four years", "regression suite", "hotel front desk", "test automation"],
      phrases: [
        { en: "I've spent the last four years …", es: "Llevo cuatro años …" },
        { en: "I looked after …", es: "Me ocupaba de …", note: "Más natural que «I was in charge of» para el día a día." },
        { en: "… which taught me to …", es: "… lo que me enseñó a …" },
        { en: "Now I'd like to move into …", es: "Ahora me gustaría pasar a …" },
      ],
      tip: "Presente, pasado y futuro, en menos de un minuto.",
      pending: null,
      seconds: 60,
    },
    {
      id: "start-why",
      block: "start",
      title: "Por qué este puesto",
      question: "What made you apply for this position?",
      variants: ["Why does this role appeal to you?"],
      answer: [
        {
          en: "Your team builds its own automation framework, and that's exactly what I want to learn.",
          es: "Vuestro equipo construye su propio framework de automatización, y eso es justo lo que quiero aprender.",
        },
        {
          en: "I also like that testers work inside the product teams, not at the end of the process.",
          es: "También me gusta que los testers trabajen dentro de los equipos de producto, no al final del proceso.",
        },
      ],
      anchors: ["automation framework", "learn", "inside the product teams"],
      phrases: [
        { en: "That's exactly what I want to …", es: "Es justo lo que quiero …" },
        { en: "I also like that …", es: "También me gusta que …" },
      ],
      tip: "Habla de ellos, no solo de ti: menciona algo concreto del puesto.",
      pending: null,
      seconds: 45,
    },
    {
      id: "start-strength",
      block: "start",
      title: "Tu punto fuerte",
      question: "What would your last manager say you're best at?",
      variants: ["What's your biggest strength?"],
      answer: [
        {
          en: "She'd probably say I'm good at writing bug reports that developers can act on straight away.",
          es: "Probablemente diría que se me da bien escribir informes de errores con los que los desarrolladores pueden ponerse a trabajar enseguida.",
        },
        {
          en: "I always include the steps, the expected result and a short screen recording.",
          es: "Siempre incluyo los pasos, el resultado esperado y una grabación corta de la pantalla.",
        },
        {
          en: "Over a few months, fewer of my reports were sent back for more detail.",
          es: "En unos meses, me devolvieron menos informes para pedir más detalle.",
        },
      ],
      anchors: ["bug reports", "steps", "expected result", "screen recording"],
      phrases: [
        { en: "She'd probably say …", es: "Probablemente diría …" },
        { en: "… that developers can act on", es: "… con los que los desarrolladores pueden ponerse a trabajar", note: "«Act on» = actuar a partir de algo." },
        { en: "fewer … were sent back", es: "me devolvieron menos …" },
      ],
      tip: "Un punto fuerte y una prueba concreta, sin inventar cifras.",
      pending: "Falta la cifra de informes devueltos: no des un número hasta confirmarlo.",
      seconds: 45,
    },
    {
      id: "star-late-bug",
      block: "star",
      title: "Un error a última hora",
      question: "Tell me about a time you found a serious bug just before a release.",
      variants: ["Have you ever had to stop a release? What happened?"],
      answer: [
        {
          en: "Two days before a release, I noticed that bookings made after midnight were saved with the wrong date.",
          es: "Dos días antes de una versión, vi que las reservas hechas después de medianoche se guardaban con la fecha equivocada.",
        },
        { en: "My job was to make sure the team understood the risk quickly.", es: "Mi tarea era que el equipo entendiera el riesgo rápidamente." },
        {
          en: "I wrote down the exact steps, showed them to the lead developer and suggested a test for every time zone we support.",
          es: "Apunté los pasos exactos, se los enseñé al desarrollador principal y propuse una prueba para cada zona horaria que soportamos.",
        },
        {
          en: "We delayed the release by one day, fixed it, and that test is still part of the suite.",
          es: "Retrasamos la versión un día, lo arreglamos, y esa prueba sigue en la batería.",
        },
      ],
      anchors: ["after midnight", "wrong date", "exact steps", "time zone", "one day"],
      phrases: [
        { en: "I noticed that …", es: "Vi que …" },
        { en: "My job was to …", es: "Mi tarea era …" },
        { en: "We delayed the release by one day.", es: "Retrasamos la versión un día." },
        { en: "… is still part of the suite.", es: "… sigue en la batería de pruebas." },
      ],
      tip: "Termina con el resultado y con lo que cambió después.",
      pending: null,
      seconds: 90,
    },
    {
      id: "star-disagree",
      block: "star",
      title: "Un desacuerdo",
      question: "Describe a situation where you disagreed with a developer.",
      variants: ["How do you handle conflict with teammates?", "Tell me about a disagreement at work."],
      answer: [
        {
          en: "A developer closed one of my bugs because it worked on his machine.",
          es: "Un desarrollador cerró uno de mis errores porque en su máquina funcionaba.",
        },
        {
          en: "Instead of reopening it straight away, I asked if we could look at it together for ten minutes.",
          es: "En vez de reabrirlo enseguida, le pregunté si podíamos mirarlo juntos diez minutos.",
        },
        {
          en: "We found it only happened on older phones, so we agreed to add one to the test devices.",
          es: "Vimos que solo pasaba en móviles antiguos, así que acordamos añadir uno a los dispositivos de prueba.",
        },
      ],
      anchors: ["his machine", "together", "older phones", "test devices"],
      phrases: [
        { en: "Instead of …, I …", es: "En vez de …, …" },
        { en: "I asked if we could …", es: "Le pregunté si podíamos …" },
        { en: "… so we agreed to …", es: "… así que acordamos …" },
      ],
      tip: "Que se note la colaboración, no quién tenía razón.",
      pending: null,
      seconds: 75,
    },
    {
      id: "star-new-tool",
      block: "star",
      title: "Aprender algo rápido",
      question: "Tell me about a time you had to pick up a new tool quickly.",
      variants: ["How do you get up to speed with new technologies?"],
      answer: [
        {
          en: "When our team switched to a new test management tool, I had a week to move our test cases.",
          es: "Cuando el equipo cambió a una herramienta nueva de gestión de pruebas, tuve una semana para pasar nuestros casos de prueba.",
        },
        {
          en: "I did the official tutorial, moved one small project first and wrote a one-page guide for the others.",
          es: "Hice el tutorial oficial, pasé primero un proyecto pequeño y escribí una guía de una página para los demás.",
        },
        {
          en: "We finished on time, and new starters still use that guide.",
          es: "Terminamos a tiempo, y la gente nueva sigue usando esa guía.",
        },
      ],
      anchors: ["new tool", "a week", "small project first", "one-page guide"],
      phrases: [
        { en: "I had a week to …", es: "Tuve una semana para …" },
        { en: "I … first.", es: "Primero …" },
        { en: "new starters", es: "la gente nueva", note: "Así se dice en Australia y Reino Unido; en EE. UU., «new hires»." },
      ],
      tip: "Explica cómo aprendes, no solo que aprendiste.",
      pending: "Falta confirmar si fue una semana o dos.",
      seconds: 75,
    },
  ],
};

export function fakeDeck(): InterviewDeck {
  return structuredClone(FAKE_DECK);
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
