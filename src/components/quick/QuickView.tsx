"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccessCard } from "@/components/coach/AccessCard";
import { useRouteGeneration } from "@/components/coach/generation";
import { focusPageHeading } from "@/components/coach/nav";
import { Notice, useOnline } from "@/components/coach/shared";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui";
import type { CoachRoute } from "@/lib/coach";
import { coachAvailable } from "@/lib/coach/available";
import { useCoachAccess, useSavedRoutes } from "@/lib/coach/use-coach";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useHydrated } from "@/lib/progress/use-progress";
import { closeRoute, openRoute, QUICK_SUBTITLE, QUICK_TITLE, ROUTE_PARAM } from "./nav";
import { QuickForm, routesLeft, type RoutesToday } from "./QuickForm";
import { RouteView } from "./RouteView";
import { SavedRoutes } from "./SavedRoutes";

const ACCESS_INTRO =
  "El modo rápido usa inteligencia artificial y necesita tu código de acceso de Prepárate. Escríbelo una vez: se guarda en este móvil.";

interface RouteNotice {
  id: string;
  tone: "success" | "info";
  text: string;
}

/**
 * /rapido/: the home (the offline notice, the access code or the form, then Mis rutas) or, with
 * `?ruta=<id>`, one route. Uses `useSearchParams`: render inside a Suspense boundary.
 */
export function QuickView() {
  const lang = useScreenLang();
  if (lang && !coachAvailable(lang)) {
    return (
      <>
        <PageHeader title={QUICK_TITLE} subtitle={QUICK_SUBTITLE} />
        <Notice tone="info">El modo rápido todavía no está disponible para este curso.</Notice>
      </>
    );
  }
  return lang ? <Quick key={lang} lang={lang} /> : <PageHeader title={QUICK_TITLE} subtitle={QUICK_SUBTITLE} />;
}

function Quick({ lang }: { lang: string }) {
  const hydrated = useHydrated();
  const param = useSearchParams().get(ROUTE_PARAM);
  const { get, remove } = useSavedRoutes(lang);
  const { hasCode } = useCoachAccess();
  const online = useOnline();
  /** The route just received: shown even when the device could not store it (lost when you leave). */
  const [fresh, setFresh] = useState<CoachRoute | null>(null);
  const [notice, setNotice] = useState<RouteNotice | null>(null);
  /** Today's route counter after the last route of this visit. */
  const [today, setToday] = useState<RoutesToday | null>(null);
  /** The description being typed: survives the form being swapped for the code card (401). */
  const [draft, setDraft] = useState("");
  const job = useRouteGeneration(lang);
  const accessNotice = job?.status === "error" && job.error.kind === "unauthorized" ? job.error.message : null;
  /** The route just deleted from its own view: shows the home until the URL catches up (history.back is async). */
  const [leaving, setLeaving] = useState<string | null>(null);
  if (leaving !== null && param !== leaving) setLeaving(null);
  const routeId = param && param !== leaving ? param : null;

  // Opening or closing a route (taps, the back button) swaps the view in place: move focus to its title.
  const shown = useRef(routeId);
  useEffect(() => {
    if (shown.current === routeId) return;
    shown.current = routeId;
    focusPageHeading();
  }, [routeId]);

  if (!hydrated) return <PageHeader title={QUICK_TITLE} subtitle={QUICK_SUBTITLE} />;

  const open = (id: string) => {
    setNotice(null);
    openRoute(id);
  };
  const back = () => {
    setNotice(null);
    closeRoute();
  };

  if (routeId) {
    const route = get(routeId) ?? (fresh?.id === routeId ? fresh : undefined);
    if (!route) {
      return (
        <>
          <PageHeader title="Ruta no encontrada" subtitle="No está guardada en este móvil: puede que la hayas borrado." />
          <Button onClick={back} fullWidth>
            Volver a Modo rápido
          </Button>
        </>
      );
    }
    return (
      <RouteView
        key={route.id}
        route={route}
        notice={notice?.id === route.id ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        onBack={back}
        onDelete={() => {
          setLeaving(route.id);
          setNotice(null);
          if (fresh?.id === route.id) setFresh(null);
          closeRoute();
          remove(route.id);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader title={QUICK_TITLE} subtitle={QUICK_SUBTITLE} />
      {!online ? (
        <Notice tone="info">
          Sin conexión. Tus rutas guardadas funcionan igual; para preparar una nueva necesitas internet.
        </Notice>
      ) : null}
      {hasCode ? (
        <QuickForm
          lang={lang}
          draft={draft}
          setDraft={setDraft}
          online={online}
          today={today}
          onCreated={(route, saved, usage) => {
            const left = routesLeft(usage.today);
            setFresh(route);
            if (left) setToday(usage.today);
            open(route.id);
            setNotice({
              id: route.id,
              tone: saved ? "success" : "info",
              text: [
                saved
                  ? "Guardada en Mis rutas: funciona sin conexión."
                  : "No he podido guardarla en este móvil: si sales de aquí, se perderá.",
                left ? `${left}.` : "",
              ]
                .filter(Boolean)
                .join(" "),
            });
          }}
        />
      ) : (
        <AccessCard intro={ACCESS_INTRO} notice={accessNotice} />
      )}
      <SavedRoutes lang={lang} onOpen={open} />
    </>
  );
}
