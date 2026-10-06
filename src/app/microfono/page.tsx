import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";
import { MicTestView } from "./MicTestView";

const tab = getTab("microphone");

export const metadata: Metadata = { title: tab.title };

/** "Probar micrófono": speech recognition diagnostics (docs/speech.md), reached from /perfil. */
export default function MicrophonePage() {
  return (
    <>
      <PageHeader
        title={tab.title}
        subtitle="Comprueba si la app te oye, cuánto tarda en cada paso y qué ha pasado en tus últimos intentos."
      />
      <MicTestView />
      <Link
        href="/perfil/"
        className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        Volver al perfil
      </Link>
    </>
  );
}
