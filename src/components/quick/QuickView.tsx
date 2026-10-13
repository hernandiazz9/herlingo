"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { focusPageHeading } from "@/components/coach/nav";
import { Notice } from "@/components/coach/shared";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui";
import { coachAvailable } from "@/lib/coach/available";
import { useSavedRoutes } from "@/lib/coach/use-coach";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useHydrated } from "@/lib/progress/use-progress";
import { closeRoute, openRoute, QUICK_SUBTITLE, QUICK_TITLE, ROUTE_PARAM } from "./nav";
import { RouteView } from "./RouteView";
import { SavedRoutes } from "./SavedRoutes";

/**
 * /rapido/: the home (the form, then Mis rutas) or, with `?ruta=<id>`, one saved route. Uses
 * `useSearchParams`: render inside a Suspense boundary.
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

  if (routeId) {
    const route = get(routeId);
    if (!route) {
      return (
        <>
          <PageHeader title="Ruta no encontrada" subtitle="No está guardada en este móvil: puede que la hayas borrado." />
          <Button onClick={closeRoute} fullWidth>
            Volver a Modo rápido
          </Button>
        </>
      );
    }
    return (
      <RouteView
        route={route}
        onBack={closeRoute}
        onDelete={() => {
          setLeaving(route.id);
          closeRoute();
          remove(route.id);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader title={QUICK_TITLE} subtitle={QUICK_SUBTITLE} />
      {/* The form ("Prepárame") goes here, above Mis rutas. */}
      <SavedRoutes lang={lang} onOpen={openRoute} />
    </>
  );
}
