/**
 * Frasario view choice ("Frases" or "Palabras"), remembered on the device. Read in React with
 * `useSyncExternalStore(subscribeView, readView, serverView)`.
 */

export type PhrasebookView = "phrases" | "words";

const KEY = "lang-lern:phrasebook-view";
const CHANGE_EVENT = "lang-lern:phrasebook-view-change";

/** Used when storage is unavailable (private mode): the choice lasts until the page closes. */
let memory: PhrasebookView | null = null;

export const serverView = (): PhrasebookView => "phrases";

export function readView(): PhrasebookView {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "words" || stored === "phrases") return stored;
  } catch {
    // Fall through to the in-memory choice.
  }
  return memory ?? "phrases";
}

export function setView(view: PhrasebookView): void {
  memory = view;
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    // Storage unavailable: `memory` keeps it.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeView(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
