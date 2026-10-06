/**
 * Error kinds of a listen session and the one Spanish message (with a concrete fix) for each.
 * Every screen shows these; nothing else words speech errors.
 */

export type ListenErrorKind =
  | "unsupported"
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "start-timeout"
  | "aborted"
  | "other";

export const LISTEN_ERROR_MESSAGES: Readonly<Record<ListenErrorKind, string>> = {
  unsupported:
    "Este navegador no reconoce la voz. En iPhone abre la app desde Safari (Chrome en iPhone no lo permite).",
  "not-allowed":
    "No tengo permiso para usar el micrófono. En el iPhone ve a Ajustes › Apps › Safari › Micrófono y elige «Permitir»; activa también Ajustes › Siri › Dictado. Luego vuelve y toca «Reintentar».",
  "no-speech": "No te oigo. Acerca el iPhone, habla un poco más alto y toca «Reintentar».",
  "audio-capture":
    "No encuentro el micrófono o lo está usando otra app. Cierra llamadas o grabaciones y toca «Reintentar».",
  network: "El reconocimiento de voz necesita conexión. Revisa tu internet y toca «Reintentar».",
  "start-timeout":
    "El micrófono no ha arrancado. Toca «Reintentar»; si sigue igual, cierra la app del todo y ábrela otra vez.",
  aborted: "Has cancelado. Toca el micrófono cuando quieras volver a hablar.",
  other: "No he podido escucharte. Toca «Reintentar» o escríbelo.",
};

/** Browser `SpeechRecognitionErrorEvent.error` codes → our kinds. */
export function errorKindFromCode(code: string | undefined): ListenErrorKind {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "audio-capture";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "other";
  }
}

export function listenErrorMessage(kind: ListenErrorKind): string {
  return LISTEN_ERROR_MESSAGES[kind];
}
