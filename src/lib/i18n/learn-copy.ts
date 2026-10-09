/**
 * Copy of the learning screens (lesson exercises and feedback, review, game rounds, dialogue player,
 * story reader and its games, the mic UI they share) in the learner's gloss language. Framework-free.
 *
 * Keys = gloss language. `es` holds the app's Spain Spanish strings verbatim (the default UI; a gloss
 * language without its own copy uses it, naming that gloss language where `es` says "español").
 * Menus, tabs, Perfil, Liga, cloud save and Prepárate never use this: they stay Spain Spanish.
 *
 * Read it in components with `useLearnCopy()` (`./use-learn-copy`); `learnCopy(lang, gloss)` here.
 * Strings that name the target language or the gloss language are already filled in for the pack.
 */
import { GLOSS_LANGUAGES, type GlossLang } from "@/lib/content/gloss";
import { languageName } from "@/lib/content";
import { LISTEN_ERROR_MESSAGES, type ListenErrorKind } from "@/lib/speech/messages";
import type { StoryGameId } from "@/lib/stories/games";

type Verdict = "correct" | "acceptable" | "wrong";
type WordStatus = "ok" | "missing" | "wrong";

export interface LearnCopy {
  // Shared buttons
  listen: string;
  slow: string;
  listenTo: (text: string) => string;
  check: string;
  continue: string;
  start: string;
  retry: string;

  // Exercises
  listenMeaning: string;
  readMeaning: string;
  answerPrompt: string;
  showQuestion: string;
  translateInto: string;
  yourAnswer: string;
  fillGap: string;
  dictation: string;
  dictationLabel: string;
  dictationPlaceholder: (canDictate: boolean) => string;
  dictateAloud: string;
  matchPairs: string;
  matchPictures: string;
  listenPicture: string;
  /** Around «gloss»: "¿Cuál es «el café»?". */
  whichIs: readonly [before: string, after: string];
  speakPrompt: string;
  wellSaid: string;
  speakResult: string;
  almostTries: (left: number) => string;
  listenPhrase: string;
  preferSelf: string;
  selfHint: string;
  selfYes: string;
  selfNo: string;
  useMic: string;
  cannotSpeak: (minutes: number) => string;
  grammarKicker: string;
  gotIt: string;
  newWord: string;

  // Lesson player and feedback sheet
  exitLesson: string;
  lessonProgress: string;
  lessonIntro: string;
  /** Around the time: "Los ejercicios de hablar están en pausa hasta las 14:30." */
  speakingPaused: readonly [before: string, after: string];
  timeLocale: string;
  canSpeakNow: string;
  again: string;
  lessonDone: string;
  perfect: string;
  keepGoing: string;
  firstTry: string;
  time: string;
  repeatLesson: string;
  praise: readonly string[];
  almost: string;
  almostPerfect: string;
  done: string;
  typoNote: string;
  accentNote: string;
  matchMistakes: (n: number) => string;
  listenAnswer: string;
  solution: string;
  heard: string;
  exitTitle: string;
  exitDescription: string;
  keepLearning: string;
  exit: string;

  // Review
  reviewTitle: (n: number) => string;
  reviewIntro: string;
  allDone: string;
  nothingYet: string;
  nextComes: (when: string) => string;
  whenLater: string;
  whenToday: string;
  whenTomorrow: string;
  whenInDays: (days: number) => string;
  reviewEmptyHint: string;
  goToPath: string;
  dueToday: string;
  dueWrong: (n: number) => string;
  dueFresh: (n: number) => string;
  dueFading: (n: number) => string;
  startReview: string;
  reviewChunks: (n: number) => string;
  inThisReview: string;

  // Game (Jugar)
  topicCount: (phrases: number, words: number) => string;
  pickTopic: string;
  mix: string;
  allTopics: (detail: string) => string;
  record: (n: number) => string;
  noRecord: string;
  noRecordYet: string;
  exitToTopics: string;
  cardsDiscovered: string;
  discover: string;
  literal: string;
  /** Discovery: send the card to the end of the deck. */
  showAgain: string;
  knowIt: string;
  toRound: string;
  roundTitle: string;
  roundHow: (has: { phrases: boolean; words: boolean }) => string;
  changeTopic: string;
  timeUp: string;
  newRecord: string;
  points: (n: number) => string;
  statRight: string;
  statCombo: string;
  toReview: string;
  toReviewHint: string;
  anotherRound: string;
  exitRound: string;
  timeLeft: string;
  streak: (mult: number, combo: number) => string;
  howDoYouSay: string;

  // Dialogue player
  verdicts: Readonly<Record<Verdict, string>>;
  dialogueIntro: (mic: boolean) => string;
  dialogueDone: string;
  dialogueScore: (right: number, total: number) => string;
  transcript: string;
  repeat: string;
  tryAgain: string;
  yourTurn: string;
  /** Around what was heard: "He oído «…», que no se parece…". */
  missHeard: readonly [before: string, after: string];
  missHint: string;
  sayAgain: string;
  orSayIt: string;
  seeSummary: string;
  listenAgain: string;
  listenSlowly: string;
  hideText: string;
  showText: string;
  youSaid: (heard: string) => string;
  ideal: string;
  you: string;
  dialogueNotFound: string;
  halfXp: string;
  answersCount: (n: number) => string;
  otherDialogues: string;

  // Story reader and games
  stop: string;
  listenAll: string;
  hideTranslation: string;
  showTranslation: string;
  readerHint: string;
  listenSentence: (n: number) => string;
  doneReading: string;
  doneReadingHint: string;
  playStory: string;
  exitGames: string;
  gameProgress: string;
  gameOf: (n: number, total: number) => string;
  storyGames: Readonly<Record<StoryGameId, { title: string; description: string }>>;
  skipThisGame: string;
  noGames: string;
  finish: string;
  skipGame: string;
  storyDone: string;
  justRead: string;
  wordsToReview: string;
  wordsToReviewHint: string;
  nextStory: string;
  backToStories: string;
  readAgain: string;
  storyExitTitle: string;
  storyExitDescription: string;
  questionPrompt: string;
  seeInGloss: string;
  orderPrompt: string;
  orderHint: string;
  perfectShort: string;
  orderMistakes: (n: number) => string;

  // Mic UI (lessons and dialogues)
  micStarting: string;
  micFinish: string;
  micWait: string;
  tapAndSpeak: string;
  dictate: string;
  micStop: string;
  statusListening: string;
  statusHearing: string;
  timeToSpeak: string;
  cancel: string;
  speechErrors: Readonly<Record<ListenErrorKind, string>>;
  wordStatus: Readonly<Record<WordStatus, string>>;
  wordLegend: Readonly<Record<WordStatus, string>>;

  // Phrasebook search
  searchPlaceholder: string;
}

interface Ctx {
  /** The pack's language code. */
  lang: string;
  gloss: GlossLang;
}

/** Spain Spanish: today's strings. `gloss` other than es (without own copy) is named where "español" was. */
function es({ lang, gloss }: Ctx): LearnCopy {
  const target = languageName(lang);
  const glossName = GLOSS_LANGUAGES[gloss].name.toLocaleLowerCase("es");
  return {
    listen: "Escuchar",
    slow: "Lento",
    listenTo: (text) => `Escuchar: ${text}`,
    check: "Comprobar",
    continue: "Continuar",
    start: "Empezar",
    retry: "Reintentar",

    listenMeaning: "Escucha y elige qué significa",
    readMeaning: "¿Qué significa?",
    answerPrompt: "Te preguntan… ¿qué respondes?",
    showQuestion: "Ver la pregunta",
    translateInto: `Tradúcelo al ${target}`,
    yourAnswer: "Tu respuesta",
    fillGap: "Completa la frase",
    dictation: "Escribe lo que oyes",
    dictationLabel: `Lo que oyes, en ${target}`,
    dictationPlaceholder: (canDictate) => (canDictate ? `Escribe o dicta en ${target}…` : `Escribe en ${target}…`),
    dictateAloud: "O díctalo en voz alta",
    matchPairs: "Une las parejas",
    matchPictures: "Une cada palabra con su imagen",
    listenPicture: "Escucha y elige la imagen",
    whichIs: ["¿Cuál es", "?"],
    speakPrompt: "Dilo en voz alta",
    wellSaid: "¡Bien dicho!",
    speakResult: "Así ha quedado:",
    almostTries: (left) => `Casi. ${left === 1 ? "Te queda un intento." : `Te quedan ${left} intentos.`}`,
    listenPhrase: "Escuchar la frase",
    preferSelf: "Prefiero evaluarme yo",
    selfHint: "Escúchalo, dilo en voz alta y sé sincero:",
    selfYes: "Me ha salido",
    selfNo: "No me ha salido",
    useMic: "Usar el micrófono",
    cannotSpeak: (minutes) => `No puedo hablar ahora (${minutes} min)`,
    grammarKicker: "Un apunte",
    gotIt: "Entendido",
    newWord: "Palabra nueva",

    exitLesson: "Salir de la lección",
    lessonProgress: "Progreso de la lección",
    lessonIntro: "Unos 5 minutos: escuchar, entender, construir frases y decirlas en voz alta. Los fallos vuelven al final.",
    speakingPaused: ["Los ejercicios de hablar están en pausa hasta las", "."],
    timeLocale: "es-ES",
    canSpeakNow: "Ya puedo hablar",
    again: "Otra vez",
    lessonDone: "¡Lección completada!",
    perfect: "Sin un solo fallo. ¡Bravissimo!",
    keepGoing: "Los fallos también enseñan. ¡Sigue así!",
    firstTry: "a la primera",
    time: "tiempo",
    repeatLesson: "Repetir lección",
    praise: ["¡Genial!", "¡Muy bien!", "¡Perfecto!", "¡Eso es!", "¡Bravo!"],
    almost: "Casi…",
    almostPerfect: "¡Casi perfecto!",
    done: "¡Hecho!",
    typoNote: "Te cuenta como bien, pero tienes un fallo de letra:",
    accentNote: "Cuidado con el acento: fíjate en cómo se escribe.",
    matchMistakes: (n) =>
      n === 1 ? "Has fallado 1 pareja, pero ya las tienes todas." : `Has fallado ${n} parejas, pero ya las tienes todas.`,
    listenAnswer: "Escuchar la respuesta",
    solution: "Solución",
    heard: "He entendido",
    exitTitle: "¿Salir de la lección?",
    exitDescription: "Si sales ahora, perderás lo que llevas de esta lección.",
    keepLearning: "Seguir aprendiendo",
    exit: "Salir",

    reviewTitle: (n) => `Repaso: ${n} ${n === 1 ? "cosa" : "cosas"}`,
    reviewIntro: "Lo que fallaste y lo que toca recordar hoy: escucha, responde y dilo en voz alta. Los fallos vuelven al final.",
    allDone: "¡Todo al día!",
    nothingYet: "Todavía no hay nada que repasar",
    nextComes: (when) => `Lo siguiente vuelve ${when}. Mientras, sigue con tu ruta.`,
    whenLater: "más adelante",
    whenToday: "hoy mismo",
    whenTomorrow: "mañana",
    whenInDays: (days) => `dentro de ${days} días`,
    reviewEmptyHint: "Cuando hagas lecciones, aquí volverá lo que falles y lo que te quede por practicar.",
    goToPath: "Ir a la ruta",
    dueToday: "Para repasar hoy",
    dueWrong: (n) => `${n} que fallaste`,
    dueFresh: (n) => `${n} sin practicar aún`,
    dueFading: (n) => `${n} a punto de olvidar`,
    startReview: "Empezar repaso",
    reviewChunks: (n) => `Cada repaso toma ${n}; puedes encadenar varios.`,
    inThisReview: "En este repaso",

    topicCount: (p, w) =>
      [p ? `${p} ${p === 1 ? "frase" : "frases"}` : "", w ? `${w} ${w === 1 ? "palabra" : "palabras"}` : ""]
        .filter(Boolean)
        .join(" · "),
    pickTopic: "Elige un tema: descubre sus palabras y frases con audio y luego juega una ronda de 60 segundos.",
    mix: "Mezcla",
    allTopics: (detail) => `Todos los temas · ${detail}`,
    record: (n) => `Récord: ${n}`,
    noRecord: "Sin récord",
    noRecordYet: "Aún sin récord",
    exitToTopics: "Salir al menú de temas",
    cardsDiscovered: "Tarjetas descubiertas",
    discover: "Descubre",
    literal: "Literal",
    showAgain: "Otra vez",
    knowIt: "La sé",
    toRound: "Ir a la ronda rápida",
    roundTitle: "Ronda rápida: 60 segundos",
    roundHow: ({ phrases, words }) =>
      `${
        !phrases
          ? `Escucha la palabra o léela en ${glossName} y elige su imagen.`
          : words
            ? `Escucha y elige qué significa, lee en ${glossName} y elige la frase en ${target}, o elige la imagen de cada palabra.`
            : `Escucha y elige qué significa, o lee en ${glossName} y elige la frase en ${target}.`
      } Encadena aciertos para multiplicar los puntos.`,
    changeTopic: "Cambiar de tema",
    timeUp: "¡Tiempo!",
    newRecord: "¡Nuevo récord!",
    points: () => "puntos",
    statRight: "Aciertos",
    statCombo: "Mejor racha",
    toReview: "Para repasar",
    toReviewHint: "Irán a tu repaso.",
    anotherRound: "Otra ronda",
    exitRound: "Salir de la ronda",
    timeLeft: "Tiempo restante",
    streak: (mult, combo) => `x${mult} · racha ${combo}`,
    howDoYouSay: `¿Cómo se dice en ${target}?`,

    verdicts: { correct: "¡Genial!", acceptable: "Se entiende", wrong: "Mejor no" },
    dialogueIntro: (mic) =>
      `Sube el volumen. Escucharás a un ${target} y tendrás que elegir${mic ? " o decir" : ""} tu respuesta. El texto está oculto: toca «Ver texto» si lo necesitas.`,
    dialogueDone: "¡Diálogo completado!",
    dialogueScore: (right, total) => `Has acertado ${right} de ${total} a la primera.`,
    transcript: "Transcripción",
    repeat: "Repetir",
    tryAgain: "Intentarlo otra vez",
    yourTurn: "Tu turno",
    missHeard: ["He oído «", "», que no se parece bastante a ninguna respuesta. La más cercana:"],
    missHint: "Prueba otra vez o toca una respuesta.",
    sayAgain: "Toca y dilo otra vez",
    orSayIt: "O dilo en voz alta",
    seeSummary: "Ver resumen",
    listenAgain: "Escuchar otra vez",
    listenSlowly: "Escuchar despacio",
    hideText: "Ocultar texto",
    showText: "Ver texto",
    youSaid: (heard) => `Has dicho: «${heard}»`,
    ideal: "Lo ideal",
    you: "Tú",
    dialogueNotFound: "No se ha encontrado este diálogo.",
    halfXp: "Ya lo habías hecho hoy: la mitad de XP.",
    answersCount: (n) => `${n} respuestas`,
    otherDialogues: "Otros diálogos",

    stop: "Parar",
    listenAll: "Escuchar todo",
    hideTranslation: "Ocultar traducción",
    showTranslation: "Ver traducción",
    readerHint: "Toca una frase para escucharla y una palabra resaltada para ver qué significa.",
    listenSentence: (n) => `Escuchar la frase ${n}`,
    doneReading: "¿Has terminado de leer?",
    doneReadingHint: "Juega con las palabras y expresiones de la historia. Puedes saltar cualquier juego.",
    playStory: "Jugar con la historia",
    exitGames: "Salir de los juegos",
    gameProgress: "Progreso del juego",
    gameOf: (n, total) => `Juego ${n} de ${total}`,
    storyGames: {
      keywords: { title: "Palabras clave", description: "Une las parejas y elige lo que oyes." },
      gaps: { title: "Completa los huecos", description: "Elige la palabra que falta en cada frase." },
      questions: { title: "Comprensión", description: "Escucha las preguntas sobre la historia y responde." },
      order: { title: "Ordena la historia", description: "Toca las frases en el orden en que pasan." },
    },
    skipThisGame: "Saltar este juego",
    noGames: "Esta historia no tiene juegos todavía.",
    finish: "Terminar",
    skipGame: "Saltar juego",
    storyDone: "¡Historia completada!",
    justRead: "Has leído la historia.",
    wordsToReview: "Palabras para repasar",
    wordsToReviewHint: "Volverán en Repaso para que no se te olviden.",
    nextStory: "Siguiente historia",
    backToStories: "Volver a Historias",
    readAgain: "Leer otra vez",
    storyExitTitle: "¿Salir de la historia?",
    storyExitDescription: "Si sales ahora, perderás lo que llevas de esta historia.",
    questionPrompt: "Responde sobre la historia",
    seeInGloss: `Ver en ${glossName}`,
    orderPrompt: "Ordena la historia",
    orderHint: "Toca las frases en el orden en que pasan.",
    perfectShort: "¡Perfecto!",
    orderMistakes: (n) =>
      n === 1 ? "Has fallado 1 vez, pero ya está en orden." : `Has fallado ${n} veces, pero ya está en orden.`,

    micStarting: "Abriendo el micrófono…",
    micFinish: "Terminar y usar lo que he dicho",
    micWait: "Un momento…",
    tapAndSpeak: "Toca y habla",
    dictate: "Dictar",
    micStop: "Terminar",
    statusListening: "Habla ahora",
    statusHearing: "Te escucho…",
    timeToSpeak: "Tiempo para hablar",
    cancel: "Cancelar",
    speechErrors: LISTEN_ERROR_MESSAGES,
    wordStatus: { ok: "bien", missing: "no lo he oído", wrong: "has dicho otra cosa" },
    wordLegend: { ok: "bien", missing: "no oída", wrong: "otra cosa" },

    searchPlaceholder: `Busca en ${target} o en ${glossName}`,
  };
}

/** Russian names of target languages by pack code (accusative = nominative for these). */
const RU_LANGUAGE: Readonly<Record<string, string>> = {
  es: "испанский",
  it: "итальянский",
  fr: "французский",
  en: "английский",
  ru: "русский",
  nl: "нидерландский",
};

/** 1 фраза, 2 фразы, 5 фраз. */
function ru3(n: number, one: string, few: string, many: string): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

/** Russian ("ты"; gender-neutral phrasing). */
function ru({ lang }: Ctx): LearnCopy {
  const adj = RU_LANGUAGE[lang];
  /** "на испанский" (into) / "по-испански" (in). */
  const into = adj ? `на ${adj}` : "на изучаемый язык";
  const inLang = adj ? `по-${adj.replace(/ий$/, "и")}` : "на изучаемом языке";
  const n3 = (n: number, one: string, few: string, many: string) => `${n} ${ru3(n, one, few, many)}`;
  return {
    listen: "Слушать",
    slow: "Медленно",
    listenTo: (text) => `Слушать: ${text}`,
    check: "Проверить",
    continue: "Дальше",
    start: "Начать",
    retry: "Ещё раз",

    listenMeaning: "Послушай и выбери, что это значит",
    readMeaning: "Что это значит?",
    answerPrompt: "Тебя спрашивают… Что ответишь?",
    showQuestion: "Показать вопрос",
    translateInto: `Переведи ${into}`,
    yourAnswer: "Твой ответ",
    fillGap: "Вставь пропущенное слово",
    dictation: "Напиши, что слышишь",
    dictationLabel: `Что ты слышишь, ${inLang}`,
    dictationPlaceholder: (canDictate) => (canDictate ? `Напиши или продиктуй ${inLang}…` : `Напиши ${inLang}…`),
    dictateAloud: "Или продиктуй вслух",
    matchPairs: "Соедини пары",
    matchPictures: "Соедини каждое слово с картинкой",
    listenPicture: "Послушай и выбери картинку",
    whichIs: ["Где", "?"],
    speakPrompt: "Скажи вслух",
    wellSaid: "Отлично сказано!",
    speakResult: "Вот что получилось:",
    almostTries: (left) =>
      left === 1 ? "Почти. Осталась одна попытка." : `Почти. Осталось попыток: ${left}.`,
    listenPhrase: "Послушать фразу",
    preferSelf: "Оценить себя самостоятельно",
    selfHint: "Послушай, скажи вслух и честно оцени себя:",
    selfYes: "Получилось",
    selfNo: "Не получилось",
    useMic: "Включить микрофон",
    cannotSpeak: (minutes) => `Сейчас не могу говорить (${minutes} мин)`,
    grammarKicker: "Заметка",
    gotIt: "Понятно",
    newWord: "Новое слово",

    exitLesson: "Выйти из урока",
    lessonProgress: "Прогресс урока",
    lessonIntro: "Около 5 минут: слушаешь, понимаешь, собираешь фразы и говоришь их вслух. Ошибки вернутся в конце.",
    speakingPaused: ["Упражнения на говорение на паузе до", "."],
    timeLocale: "ru-RU",
    canSpeakNow: "Уже могу говорить",
    again: "Повтор",
    lessonDone: "Урок пройден!",
    perfect: "Ни одной ошибки. Браво!",
    keepGoing: "На ошибках учатся. Так держать!",
    firstTry: "с первого раза",
    time: "время",
    repeatLesson: "Пройти урок ещё раз",
    praise: ["Отлично!", "Очень хорошо!", "Идеально!", "Именно так!", "Браво!"],
    almost: "Почти…",
    almostPerfect: "Почти идеально!",
    done: "Готово!",
    typoNote: "Засчитано, но есть опечатка:",
    accentNote: "Обрати внимание на знаки над буквами: посмотри, как это пишется.",
    matchMistakes: (n) => `Ошибок в парах: ${n}, но теперь все пары собраны.`,
    listenAnswer: "Послушать ответ",
    solution: "Правильный ответ",
    heard: "Распознано",
    exitTitle: "Выйти из урока?",
    exitDescription: "Если выйдешь сейчас, прогресс этого урока пропадёт.",
    keepLearning: "Продолжить урок",
    exit: "Выйти",

    reviewTitle: (n) => `Повторение: ${n3(n, "карточка", "карточки", "карточек")}`,
    reviewIntro: "Твои ошибки и то, что пора вспомнить сегодня: слушай, отвечай и говори вслух. Ошибки вернутся в конце.",
    allDone: "Всё повторено!",
    nothingYet: "Пока нечего повторять",
    nextComes: (when) => `Следующее повторение — ${when}. А пока продолжай свой маршрут.`,
    whenLater: "позже",
    whenToday: "сегодня",
    whenTomorrow: "завтра",
    whenInDays: (days) => `через ${n3(days, "день", "дня", "дней")}`,
    reviewEmptyHint: "Когда начнёшь проходить уроки, здесь появятся твои ошибки и то, что стоит потренировать.",
    goToPath: "К маршруту",
    dueToday: "Повторить сегодня",
    dueWrong: (n) => `с ошибками: ${n}`,
    dueFresh: (n) => `ещё без практики: ${n}`,
    dueFading: (n) => `скоро забудутся: ${n}`,
    startReview: "Начать повторение",
    reviewChunks: (n) => `За одно повторение — ${n3(n, "карточка", "карточки", "карточек")}; можно пройти несколько подряд.`,
    inThisReview: "В этом повторении",

    topicCount: (p, w) =>
      [p ? n3(p, "фраза", "фразы", "фраз") : "", w ? n3(w, "слово", "слова", "слов") : ""].filter(Boolean).join(" · "),
    pickTopic: "Выбери тему: познакомься с её словами и фразами (с аудио), а потом сыграй раунд на 60 секунд.",
    mix: "Микс",
    allTopics: (detail) => `Все темы · ${detail}`,
    record: (n) => `Рекорд: ${n}`,
    noRecord: "Рекорда нет",
    noRecordYet: "Рекорда пока нет",
    exitToTopics: "Назад к темам",
    cardsDiscovered: "Изученные карточки",
    discover: "Знакомство",
    literal: "Дословно",
    showAgain: "Ещё раз",
    knowIt: "Знаю",
    toRound: "К быстрому раунду",
    roundTitle: "Быстрый раунд: 60 секунд",
    roundHow: ({ phrases, words }) =>
      `${
        !phrases
          ? "Послушай слово или прочитай его по-русски и выбери картинку."
          : words
            ? `Послушай и выбери, что это значит; прочитай по-русски и выбери фразу ${inLang}; или выбери картинку к слову.`
            : `Послушай и выбери, что это значит, или прочитай по-русски и выбери фразу ${inLang}.`
      } Отвечай верно несколько раз подряд, чтобы умножать очки.`,
    changeTopic: "Сменить тему",
    timeUp: "Время вышло!",
    newRecord: "Новый рекорд!",
    points: (n) => ru3(n, "очко", "очка", "очков"),
    statRight: "Верно",
    statCombo: "Лучшая серия",
    toReview: "Повторить",
    toReviewHint: "Они попадут в повторение.",
    anotherRound: "Ещё раунд",
    exitRound: "Выйти из раунда",
    timeLeft: "Осталось времени",
    streak: (mult, combo) => `x${mult} · серия ${combo}`,
    howDoYouSay: `Как сказать ${inLang}?`,

    verdicts: { correct: "Отлично!", acceptable: "Тебя поймут", wrong: "Лучше не так" },
    dialogueIntro: (mic) =>
      `Сделай звук погромче. Ты услышишь носителя языка и выберешь${mic ? " или скажешь" : ""} свой ответ. Текст скрыт: нажми «Показать текст», если нужно.`,
    dialogueDone: "Диалог пройден!",
    dialogueScore: (right, total) => `С первого раза: ${right} из ${total}.`,
    transcript: "Весь диалог",
    repeat: "Ещё раз",
    tryAgain: "Попробовать ещё раз",
    yourTurn: "Твоя очередь",
    missHeard: ["Распознано: «", "» — это не похоже ни на один из ответов. Ближе всего:"],
    missHint: "Попробуй ещё раз или нажми на ответ.",
    sayAgain: "Нажми и скажи ещё раз",
    orSayIt: "Или скажи вслух",
    seeSummary: "Итоги",
    listenAgain: "Послушать ещё раз",
    listenSlowly: "Послушать медленно",
    hideText: "Скрыть текст",
    showText: "Показать текст",
    youSaid: (heard) => `Распознано: «${heard}»`,
    ideal: "Лучше всего",
    you: "Ты",
    dialogueNotFound: "Диалог не найден.",
    halfXp: "Этот диалог сегодня уже пройден: половина XP.",
    answersCount: (n) => n3(n, "ответ", "ответа", "ответов"),
    otherDialogues: "Другие диалоги",

    stop: "Стоп",
    listenAll: "Слушать всё",
    hideTranslation: "Скрыть перевод",
    showTranslation: "Показать перевод",
    readerHint: "Нажми на фразу, чтобы её послушать, и на выделенное слово, чтобы узнать, что оно значит.",
    listenSentence: (n) => `Послушать фразу ${n}`,
    doneReading: "Всё прочитано?",
    doneReadingHint: "Поиграй со словами и выражениями из истории. Любую игру можно пропустить.",
    playStory: "Играть с историей",
    exitGames: "Выйти из игр",
    gameProgress: "Прогресс игры",
    gameOf: (n, total) => `Игра ${n} из ${total}`,
    storyGames: {
      keywords: { title: "Ключевые слова", description: "Соедини пары и выбери то, что слышишь." },
      gaps: { title: "Заполни пропуски", description: "Выбери слово, которого не хватает в каждой фразе." },
      questions: { title: "Понимание", description: "Послушай вопросы по истории и ответь." },
      order: { title: "Восстанови порядок", description: "Нажимай на фразы в том порядке, в каком всё происходит." },
    },
    skipThisGame: "Пропустить эту игру",
    noGames: "У этой истории пока нет игр.",
    finish: "Завершить",
    skipGame: "Пропустить игру",
    storyDone: "История пройдена!",
    justRead: "История прочитана.",
    wordsToReview: "Слова для повторения",
    wordsToReviewHint: "Они вернутся в разделе «Repaso», чтобы не забылись.",
    nextStory: "Следующая история",
    backToStories: "Ко всем историям",
    readAgain: "Прочитать ещё раз",
    storyExitTitle: "Выйти из истории?",
    storyExitDescription: "Если выйдешь сейчас, прогресс этой истории пропадёт.",
    questionPrompt: "Ответь на вопрос по истории",
    seeInGloss: "Показать по-русски",
    orderPrompt: "Восстанови порядок",
    orderHint: "Нажимай на фразы в том порядке, в каком всё происходит.",
    perfectShort: "Идеально!",
    orderMistakes: (n) => `Ошибок: ${n}, но теперь всё по порядку.`,

    micStarting: "Включаю микрофон…",
    micFinish: "Закончить и использовать сказанное",
    micWait: "Секунду…",
    tapAndSpeak: "Нажми и говори",
    dictate: "Диктовать",
    micStop: "Закончить",
    statusListening: "Говори",
    statusHearing: "Слушаю…",
    timeToSpeak: "Время на ответ",
    cancel: "Отмена",
    speechErrors: {
      unsupported: "Этот браузер не распознаёт речь. На iPhone открой приложение через Safari (Chrome на iPhone этого не умеет).",
      "not-allowed":
        "Нет доступа к микрофону. На iPhone открой Настройки › Приложения › Safari › Микрофон и выбери «Разрешить»; включи также Настройки › Siri › Диктовка. Потом вернись и нажми «Ещё раз».",
      "no-speech": "Тебя не слышно. Поднеси iPhone ближе, говори чуть громче и нажми «Ещё раз».",
      "audio-capture": "Микрофон не найден или занят другим приложением. Заверши звонки и записи и нажми «Ещё раз».",
      network: "Для распознавания речи нужен интернет. Проверь подключение и нажми «Ещё раз».",
      "start-timeout": "Микрофон не включился. Нажми «Ещё раз»; если не поможет, полностью закрой приложение и открой снова.",
      aborted: "Отменено. Нажми на микрофон, когда захочешь говорить снова.",
      other: "Не получилось тебя расслышать. Нажми «Ещё раз» или напиши ответ.",
    },
    wordStatus: { ok: "верно", missing: "не услышано", wrong: "сказано другое" },
    wordLegend: { ok: "верно", missing: "не услышано", wrong: "другое" },

    searchPlaceholder: `Ищи ${inLang} или по-русски`,
  };
}

/** Copy per gloss language; a language without its own copy uses `es` (Spain Spanish UI). */
const COPY: Partial<Record<GlossLang, (ctx: Ctx) => LearnCopy>> = { es, ru };

const cache = new Map<string, LearnCopy>();

/** The learning-screen copy for pack `lang` with the learner's gloss language `gloss`. */
export function learnCopy(lang: string, gloss: GlossLang): LearnCopy {
  const key = `${lang}|${gloss}`;
  let copy = cache.get(key);
  if (!copy) {
    copy = (COPY[gloss] ?? es)({ lang, gloss });
    cache.set(key, copy);
  }
  return copy;
}
