"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { stop } from "@/lib/audio";
import { getPack, languageName } from "@/lib/content";
import { cn } from "@/lib/cn";
import { checkAnswer, spellNumbers, type DictationExercise as Dictation } from "@/lib/exercises";
import { canRecognize, listenOnce, type RecognitionSession } from "@/lib/speech";
import { MicIcon, PlayControls, Prompt, useLessonLang, type ExerciseProps } from "./shared";

const noSubscribe = () => () => {};

/**
 * Hear the target language, type it (or say it: the microphone writes what it heard, editable).
 * Accents and punctuation are forgiven (with a note for accents); a small typo counts as right ("almost").
 */
export function DictationExercise({ exercise, answered, onAnswer }: ExerciseProps<Dictation>) {
  const lang = useLessonLang();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const session = useRef<RecognitionSession | null>(null);
  const micAvailable = useSyncExternalStore(noSubscribe, canRecognize, () => false);

  useEffect(() => () => session.current?.abort(), []);

  const check = () => {
    if (answered || !text.trim()) return;
    session.current?.abort();
    const result = checkAnswer(text, exercise.accepted, { typos: true });
    onAnswer({ correct: result.correct, accentNote: result.accentNote, typo: result.typo, given: text.trim() });
  };

  const listen = () => {
    if (answered) return;
    if (listening) {
      session.current?.stop();
      return;
    }
    stop();
    const { meta } = getPack(lang);
    const s = listenOnce(meta.speechLocale);
    session.current = s;
    setListening(true);
    setNotice(null);
    void s.result.then((r) => {
      if (session.current !== s) return;
      session.current = null;
      setListening(false);
      if (r.ok) {
        setText(spellNumbers(r.transcripts[0] ?? "", meta.numberWords));
        return;
      }
      if (r.error === "aborted") return;
      setNotice(
        r.error === "no-speech"
          ? "No te he oído. Toca el micro y habla más cerca."
          : r.error === "not-allowed"
            ? "No tengo permiso para usar el micro. Escríbelo con el teclado."
            : "El reconocimiento de voz no funciona ahora. Escríbelo con el teclado.",
      );
    });
  };

  return (
    <form
      className="flex flex-1 flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <Prompt>Escribe lo que oyes</Prompt>
      <PlayControls audio={exercise.audio} />
      <label className="flex flex-col gap-2">
        <span className="sr-only">Lo que oyes, en {languageName(lang)}</span>
        <textarea
          lang={lang}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              check();
            }
          }}
          readOnly={answered}
          rows={3}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder={micAvailable ? `Escribe o dicta en ${languageName(lang)}…` : `Escribe en ${languageName(lang)}…`}
          className="w-full resize-none rounded-card border-2 border-line bg-surface p-4 text-xl font-bold text-ink placeholder:font-normal placeholder:text-ink-muted focus:border-sea focus:outline-none"
        />
      </label>
      {micAvailable && !answered ? (
        <button
          type="button"
          onClick={listen}
          aria-pressed={listening}
          className={cn(
            "pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-button px-4 font-bold",
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
            listening
              ? "animate-pulse bg-terracotta text-on-accent [--ledge:var(--terracotta-ledge)] motion-reduce:animate-none"
              : "border-2 border-line bg-surface text-terracotta-deep [--ledge:var(--line)]",
          )}
        >
          <MicIcon className="size-5" /> {listening ? "Te escucho… (toca para parar)" : "O díctalo en voz alta"}
        </button>
      ) : null}
      {notice ? <p className="rounded-button bg-lemon-soft px-4 py-3 text-base text-ink">{notice}</p> : null}
      <div className="mt-auto">
        <Button type="submit" fullWidth disabled={answered || !text.trim()}>
          Comprobar
        </Button>
      </div>
    </form>
  );
}
