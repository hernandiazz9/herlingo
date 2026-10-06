"use client";

import { useSyncExternalStore } from "react";
import { readSpeechLog, subscribeSpeechLog, type SpeechLogEntry } from "@/lib/speech";

const EMPTY: SpeechLogEntry[] = [];
let cache: SpeechLogEntry[] | null = null;

function subscribe(onChange: () => void): () => void {
  cache = null; // anything may have been logged while nobody was listening
  return subscribeSpeechLog(() => {
    cache = null;
    onChange();
  });
}

function snapshot(): SpeechLogEntry[] {
  cache ??= readSpeechLog();
  return cache;
}

/** The diagnostics log (`lang-lern:speech-log`), oldest first, live. Empty on the server. */
export function useSpeechLog(): SpeechLogEntry[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
