"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { LeagueProfile } from "@/lib/league/account";
import type { UseLeagueAccount } from "@/lib/league/use-league-account";
import { ProfileForm } from "./ProfileForm";

export interface ProfileCardProps {
  profile: LeagueProfile;
  account: UseLeagueAccount;
}

/** Joined: who you are in the Liga (emoji + nickname) with "Editar" (same form as joining). */
export function ProfileCard({ profile, account }: ProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  if (editing) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">Editar tu perfil</h2>
        <ProfileForm
          initialNickname={profile.nickname}
          initialEmoji={profile.emoji}
          submitLabel="Guardar"
          pendingLabel="Guardando…"
          requireChange
          online={account.online}
          onSubmit={async (nickname, emoji) => {
            await account.updateProfile(nickname, emoji);
            setEditing(false);
            setSaved(true);
          }}
          onCancel={() => setEditing(false)}
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-line bg-sand text-4xl leading-none"
        >
          {profile.emoji}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-xl font-extrabold text-ink">{profile.nickname}</p>
          <p role="status" className="text-sm text-ink-muted">
            {saved ? "Perfil guardado." : account.online ? "Estás en la Liga." : "Estás en la Liga · sin conexión"}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="md"
        fullWidth
        onClick={() => {
          setSaved(false);
          setEditing(true);
        }}
      >
        Editar apodo y emoji
      </Button>
    </Card>
  );
}
