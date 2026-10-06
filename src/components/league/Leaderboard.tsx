"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useLeagueGroup } from "@/lib/league/groups";
import {
  agoLabel,
  countdownLabel,
  nextWeekReset,
  useLeaderboard,
  type LeaderboardRow,
  type LeaderboardScope,
} from "@/lib/league/leaderboard";
import { TEXT_BUTTON } from "./copy";

const MEDALS = ["🥇", "🥈", "🥉"];

const TAB =
  "min-h-11 flex-1 rounded-button px-3 text-base font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

const xpLabel = (xp: number) => `${xp.toLocaleString("es-ES")} XP`;

/** Weekly ranking: Grupo / Global switch, podium, the table (top 50 + me), countdown and last week. */
export function Leaderboard({ online }: { online: boolean }) {
  const group = useLeagueGroup();
  const hasGroup = group.group !== null;
  const [choice, setChoice] = useState<LeaderboardScope | null>(null);
  const scope: LeaderboardScope = choice ?? (hasGroup ? "group" : "global");
  const groupMissing = scope === "group" && !hasGroup;
  const lang = useScreenLang();
  const state = useLeaderboard(lang ?? "", scope, lang !== null && !groupMissing);
  const { board, loading, failed, now } = state;

  const rows = board?.rows ?? [];
  const withXp = rows.filter((r) => r.weeklyXp > 0);
  const podium = withXp.slice(0, 3);
  const rest = rows.filter((r) => !podium.includes(r));
  const offline = failed || !online;

  return (
    <section aria-labelledby="league-ranking-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="league-ranking-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Clasificación
        </h2>
        <p className="text-sm font-bold text-ink-muted">{countdownLabel(nextWeekReset(now) - now)}</p>
      </div>

      <div role="tablist" aria-label="Tipo de clasificación" className="flex gap-1 rounded-button bg-sand p-1">
        {(["group", "global"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            id={`league-tab-${s}`}
            aria-selected={scope === s}
            aria-controls="league-board"
            className={cn(TAB, scope === s ? "bg-surface text-sea-deep shadow-sm" : "text-ink-muted hover:text-ink")}
            onClick={() => setChoice(s)}
          >
            {s === "group" ? "Grupo" : "Global"}
          </button>
        ))}
      </div>

      <div id="league-board" role="tabpanel" aria-labelledby={`league-tab-${scope}`} className="flex flex-col gap-3">
        {groupMissing ? (
          <Card tone="sea" className="flex flex-col gap-1">
            <p className="text-lg font-bold text-ink">Aún no tienes grupo</p>
            <p className="text-base text-ink">
              Crea uno o únete con un código en «Tu grupo» y compite solo con tus amigos.
            </p>
            <button type="button" className={TEXT_BUTTON} onClick={() => setChoice("global")}>
              Ver la clasificación global
            </button>
          </Card>
        ) : (
          <>
            {board && offline ? (
              <p role="status" className="text-sm font-bold text-ink-muted">
                Sin conexión · actualizado {agoLabel(now - board.updatedAt)}
              </p>
            ) : null}

            {loading ? (
              <Card aria-busy="true" className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-10 rounded-button bg-line motion-safe:animate-pulse" />
                ))}
                <span className="sr-only">Cargando la clasificación…</span>
              </Card>
            ) : !board ? (
              <Card tone="lemon" role="status" className="text-base text-ink">
                {offline
                  ? "Sin conexión. Conéctate a internet para ver la clasificación."
                  : "No hemos podido cargar la clasificación."}{" "}
                {!offline ? (
                  <button type="button" className={TEXT_BUTTON} onClick={state.refresh}>
                    Reintentar
                  </button>
                ) : null}
              </Card>
            ) : (
              <>
                {podium.length > 0 ? (
                  <Podium rows={podium} />
                ) : (
                  <Card tone="lemon" className="text-base text-ink">
                    Nadie ha sumado XP esta semana. ¡Haz una lección y sé el primero!
                  </Card>
                )}

                {rest.length > 0 ? (
                  <ol className="flex flex-col gap-2" aria-label="Resto de la clasificación">
                    {rest.map((row, i) => (
                      <li key={`${row.rank}-${row.nickname}-${i}`}>
                        {i > 0 && row.rank - rest[i - 1].rank > 1 && row.isMe ? (
                          <p aria-hidden="true" className="pb-1 text-center text-ink-muted">
                            ···
                          </p>
                        ) : null}
                        <Row row={row} />
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            )}

            {board && board.lastWeek.length > 0 ? <LastWeek rows={board.lastWeek} /> : null}
          </>
        )}
      </div>
    </section>
  );
}

function Name({ row, className }: { row: LeaderboardRow; className?: string }) {
  return (
    <span className={cn("min-w-0 truncate font-bold text-ink", className)}>
      {row.nickname}
      {row.isMe ? <span className="font-normal text-ink-muted"> (tú)</span> : null}
    </span>
  );
}

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-card border-2 px-4 py-2",
        row.isMe ? "border-sea bg-sea-soft" : "border-line bg-surface",
      )}
      aria-current={row.isMe ? "true" : undefined}
    >
      <span className="w-8 shrink-0 text-center text-lg font-extrabold tabular-nums text-ink-muted">{row.rank}</span>
      <span aria-hidden="true" className="text-2xl">
        {row.emoji}
      </span>
      <Name row={row} className="flex-1 text-base" />
      <span className="shrink-0 text-base font-extrabold tabular-nums text-ink">{xpLabel(row.weeklyXp)}</span>
    </div>
  );
}

/** Top 3 of this week (2nd, 1st, 3rd side by side; the 1st stands higher). */
function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return (
    <ol aria-label="Podio de esta semana" className="grid grid-cols-3 items-end gap-2">
      {order.map((row) => {
        const place = rows.indexOf(row);
        return (
          <li
            key={`${row.rank}-${row.nickname}`}
            aria-current={row.isMe ? "true" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-card border-2 px-2 py-3 text-center",
              place === 0 ? "pb-5 pt-5" : "",
              row.isMe ? "border-sea bg-sea-soft" : place === 0 ? "border-lemon bg-lemon-soft" : "border-line bg-surface",
            )}
          >
            <span aria-hidden="true" className="text-xl">
              {MEDALS[place]}
            </span>
            <span aria-hidden="true" className={place === 0 ? "text-4xl" : "text-3xl"}>
              {row.emoji}
            </span>
            <Name row={row} className="w-full text-sm" />
            <span className="text-sm font-extrabold tabular-nums text-ink">{xpLabel(row.weeklyXp)}</span>
            <span className="sr-only">Puesto {row.rank}</span>
          </li>
        );
      })}
    </ol>
  );
}

function LastWeek({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-lg font-extrabold text-ink">La semana pasada</h3>
      <ol className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <li key={`${row.rank}-${row.nickname}-${i}`} className="flex min-h-11 items-center gap-3">
            <span aria-hidden="true" className="w-8 shrink-0 text-center text-xl">
              {MEDALS[Math.min(row.rank, 3) - 1] ?? row.rank}
            </span>
            <span className="sr-only">Puesto {row.rank}</span>
            <span aria-hidden="true" className="text-2xl">
              {row.emoji}
            </span>
            <Name row={row} className="flex-1 text-base" />
            <span className="shrink-0 text-base font-extrabold tabular-nums text-ink">{xpLabel(row.weeklyXp)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
