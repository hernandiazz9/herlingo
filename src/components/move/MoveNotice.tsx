"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { APP_NAME, PREVIOUS_APP_NAME } from "@/lib/app-config";
import { moveNoticeSnoozed, snoozeMoveNotice } from "@/lib/move";
import { MOVE_SECTION_ID } from "./MoveSection";
import { useLegacyHost } from "./use-legacy-host";

/** The route's card on an old address: «Cómo pasarme» (Perfil's steps) or «Ahora no» (a week). */
export function MoveNotice() {
  const legacy = useLegacyHost();
  const [hidden, setHidden] = useState(false);
  if (!legacy || hidden || moveNoticeSnoozed()) return null;

  const later = () => {
    snoozeMoveNotice();
    setHidden(true);
  };

  return (
    <Card tone="sea" role="region" aria-labelledby="move-notice-title" className="flex flex-col gap-3">
      <p id="move-notice-title" className="text-lg font-extrabold text-ink">
        <span aria-hidden="true">🏡 </span>
        {APP_NAME} se muda
      </p>
      <p className="text-base text-ink">
        {PREVIOUS_APP_NAME} ahora se llama {APP_NAME} y tiene dirección nueva. Esta sigue funcionando: pásate cuando quieras,
        con todos tus datos.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/perfil/#${MOVE_SECTION_ID}`}
          className="pressable inline-flex min-h-12 items-center justify-center rounded-button bg-sea px-4 text-base font-bold tracking-wide text-on-accent [--ledge:var(--sea-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
        >
          Cómo pasarme
        </Link>
        <Button size="md" variant="secondary" onClick={later}>
          Ahora no
        </Button>
      </div>
    </Card>
  );
}
