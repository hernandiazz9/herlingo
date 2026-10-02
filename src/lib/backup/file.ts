/**
 * Hands a backup file to the user (browser only). On phones (installed iOS app: downloads go
 * nowhere useful) the share sheet when it accepts files, so it can be saved to Archivos; elsewhere,
 * or if the share sheet fails, a normal download.
 */

export type SaveOutcome = "shared" | "downloaded" | "cancelled";

export async function saveFile(text: string, fileName: string): Promise<SaveOutcome> {
  const file = new File([text], fileName, { type: "application/json" });
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Share sheet unavailable after all: fall back to a download.
    }
  }
  download(file);
  return "downloaded";
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
