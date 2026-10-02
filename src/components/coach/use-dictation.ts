"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { stop } from "@/lib/audio";
import { canRecognize, listenOnce, type RecognitionError, type RecognitionSession } from "@/lib/speech";

/** The learner describes situations in their own language, the language of the UI copy. */
const DICTATION_LOCALE = "es-ES";
const DICTATION_TIMEOUT_MS = 15_000;

const ERRORS: Record<Exclude<RecognitionError, "aborted">, string> = {
  unsupported: "Tu navegador no permite dictar. Escríbelo, por favor.",
  "not-allowed": "No tengo permiso para usar el micrófono. Puedes escribirlo.",
  "no-speech": "No te he oído. Toca «Dictar» y habla.",
  network: "No he podido escucharte: revisa la conexión.",
  other: "No he podido escucharte. Inténtalo otra vez o escríbelo.",
};

const noSubscribe = () => () => {};

/**
 * Spanish dictation into a text field when the browser has speech recognition (feature-detected:
 * `available` is false on the server and where it is missing, e.g. Chrome on iOS). `toggle()`
 * starts listening (call it from a tap) or stops and keeps what was heard; `onText` gets the
 * best transcript.
 */
export function useDictation(onText: (text: string) => void) {
  const available = useSyncExternalStore(noSubscribe, canRecognize, () => false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef<RecognitionSession | null>(null);

  useEffect(() => () => session.current?.abort(), []);

  const toggle = () => {
    if (session.current) {
      session.current.stop();
      return;
    }
    stop();
    setMessage(null);
    const current = listenOnce(DICTATION_LOCALE, DICTATION_TIMEOUT_MS);
    session.current = current;
    setListening(true);
    void current.result.then((result) => {
      if (session.current !== current) return;
      session.current = null;
      setListening(false);
      if (result.ok) onText(result.transcripts[0]);
      else if (result.error !== "aborted") setMessage(ERRORS[result.error]);
    });
  };

  const cancel = () => {
    session.current?.abort();
    session.current = null;
    setListening(false);
  };

  return { available, listening, message, toggle, cancel };
}
