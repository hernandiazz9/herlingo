"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui";
import type { CoachPack } from "@/lib/coach";
import { useCoachAccess, useCoachUsage, useSavedPacks } from "@/lib/coach/use-coach";
import { coachAvailable } from "@/lib/coach/available";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useHydrated } from "@/lib/progress/use-progress";
import { AccessCard } from "./AccessCard";
import { BudgetLine } from "./BudgetLine";
import { LevelHint } from "./LevelHint";
import { newPackJob, useGeneration } from "./generation";
import { closePack, focusPageHeading, openPack, PACK_PARAM, PREPARE_SUBTITLE, PREPARE_TITLE } from "./nav";
import { PackView } from "./PackView";
import { SavedPacks } from "./SavedPacks";
import { CoachUnavailable, Notice, useOnline } from "./shared";
import { SituationForm } from "./SituationForm";

interface PackNotice {
  id: string;
  tone: "success" | "info";
  text: string;
}

/** Of the stored pack and the one just received (storage may have failed), the newest version. */
function newest(saved: CoachPack | undefined, fresh: CoachPack | undefined): CoachPack | undefined {
  if (!saved || !fresh) return saved ?? fresh;
  return fresh.refinements > saved.refinements ? fresh : saved;
}

/**
 * /preparar/: the home (access code or the situation form, the budget line, Mis situaciones) or,
 * with `?pack=<id>`, one pack. Uses `useSearchParams`: render inside a Suspense boundary.
 */
export function CoachView() {
  const lang = useScreenLang();
  if (lang && !coachAvailable(lang)) {
    return (
      <>
        <PageHeader title={PREPARE_TITLE} subtitle={PREPARE_SUBTITLE} />
        <CoachUnavailable />
      </>
    );
  }
  return lang ? <Coach key={lang} lang={lang} /> : <PageHeader title={PREPARE_TITLE} subtitle={PREPARE_SUBTITLE} />;
}

function Coach({ lang }: { lang: string }) {
  const hydrated = useHydrated();
  const packId = useSearchParams().get(PACK_PARAM);
  const { packs } = useSavedPacks(lang);
  const { hasCode } = useCoachAccess();
  const usage = useCoachUsage();
  const online = useOnline();
  const [fresh, setFresh] = useState<CoachPack | null>(null);
  const [notice, setNotice] = useState<PackNotice | null>(null);
  /** The description being typed: survives the form being swapped for the code card (401). */
  const [draft, setDraft] = useState("");
  const job = useGeneration(newPackJob(lang));
  const accessNotice = job?.status === "error" && job.error.kind === "unauthorized" ? job.error.message : null;

  // Opening or closing a pack (taps, the back button) swaps the view in place: move focus to its title.
  const shownPack = useRef(packId);
  useEffect(() => {
    if (shownPack.current === packId) return;
    shownPack.current = packId;
    focusPageHeading();
  }, [packId]);

  if (!hydrated) return <PageHeader title={PREPARE_TITLE} subtitle={PREPARE_SUBTITLE} />;

  const open = (id: string) => {
    setNotice(null);
    openPack(id);
  };
  const back = () => {
    setNotice(null);
    closePack();
  };

  if (packId) {
    const pack = newest(
      packs.find((p) => p.id === packId),
      fresh?.id === packId ? fresh : undefined,
    );
    if (!pack) {
      return (
        <>
          <PageHeader title="Situación no encontrada" subtitle="No está guardada en este móvil: puede que la hayas borrado." />
          <Button onClick={back} fullWidth>
            Volver a Prepárate
          </Button>
        </>
      );
    }
    return (
      <PackView
        pack={pack}
        notice={notice?.id === pack.id ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        onBack={back}
        onRefined={(next, saved) => {
          setFresh(next);
          setNotice({
            id: next.id,
            tone: saved ? "success" : "info",
            text: saved
              ? "¡Listo! Esta es la nueva versión."
              : "Esta es la nueva versión, pero no he podido guardarla en este móvil.",
          });
          window.scrollTo({ top: 0 });
          requestAnimationFrame(focusPageHeading);
        }}
      />
    );
  }

  const usageNotice = usage.error?.kind === "unauthorized" ? usage.error.message : null;
  return (
    <>
      <PageHeader title={PREPARE_TITLE} subtitle={PREPARE_SUBTITLE} />
      {!online ? (
        <Notice tone="info">
          Sin conexión. Tus situaciones guardadas funcionan igual; para preparar una nueva necesitas internet.
        </Notice>
      ) : null}
      {hasCode ? (
        <>
          <BudgetLine usage={usage.usage} loading={usage.loading} />
          <LevelHint lang={lang} />
          <SituationForm
            lang={lang}
            draft={draft}
            setDraft={setDraft}
            onCreated={(pack, saved) => {
              setFresh(pack);
              open(pack.id);
              setNotice({
                id: pack.id,
                tone: saved ? "success" : "info",
                text: saved
                  ? "Guardada en Mis situaciones: podrás repasarla sin conexión."
                  : "No he podido guardarla en este móvil: si sales de aquí, se perderá.",
              });
            }}
          />
        </>
      ) : (
        <AccessCard notice={accessNotice ?? usageNotice} />
      )}
      <SavedPacks lang={lang} onOpen={open} />
    </>
  );
}
