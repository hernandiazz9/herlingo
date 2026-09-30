import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui";
import { OfflineStatus } from "./OfflineStatus";

export const metadata: Metadata = { title: "Instalar en el iPhone" };

/** Install guide: add the app to the iPhone home screen (Chrome or Safari) and use it offline. */
export default function InstallPage() {
  return (
    <>
      <PageHeader
        title="Instalar en el iPhone"
        subtitle="Tenla en la pantalla de inicio como una app más y úsala sin conexión: en el avión, en el metro o sin datos."
      />

      <OfflineStatus />

      <Guide
        title="Desde Chrome"
        steps={[
          <>Abre la app en Chrome (necesitas iOS 16.4 o posterior).</>,
          <>
            Toca el botón <b>Compartir</b> (el cuadrado con una flecha hacia arriba), a la derecha de la barra de
            direcciones.
          </>,
          <>
            Desliza hacia abajo y toca <b>Añadir a pantalla de inicio</b>.
          </>,
          <>
            Toca <b>Añadir</b>. Ábrela siempre desde su icono.
          </>,
        ]}
      />

      <Guide
        title="Desde Safari"
        steps={[
          <>Abre la misma dirección en Safari.</>,
          <>
            Toca el botón <b>Compartir</b> (abajo; si no lo ves, toca antes <b>···</b>).
          </>,
          <>
            Toca <b>Añadir a pantalla de inicio</b>. Si aparece <b>Abrir como app web</b>, déjalo activado.
          </>,
          <>
            Toca <b>Añadir</b>.
          </>,
        ]}
      />

      <Card tone="terracotta" className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-ink">El micrófono va mejor en Safari</h2>
        <p className="text-sm text-ink">
          Los ejercicios de hablar usan el reconocimiento de voz del navegador. En Chrome para iPhone suele no estar
          disponible: entonces te escuchas y te autoevalúas. Si quieres que la app te corrija al hablar, instálala desde
          Safari.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-ink">Antes de viajar</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
          <li>Abre la app instalada (desde su icono) una vez con wifi y espera a ver «Lista para usar sin conexión» arriba.</li>
          <li>Instálala antes de empezar: la app de la pantalla de inicio guarda su propio progreso, aparte del de la pestaña del navegador.</li>
          <li>
            Cuando haya una versión nueva verás un aviso: toca <b>Actualizar</b>.
          </li>
        </ul>
      </Card>

      <Link
        href="/perfil/"
        className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        Volver al perfil
      </Link>
    </>
  );
}

function Guide({ title, steps }: { title: string; steps: ReactNode[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
      <Card>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-base text-ink">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sea text-sm font-bold text-on-accent"
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
