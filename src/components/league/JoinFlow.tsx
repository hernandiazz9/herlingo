"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { UseLeagueAccount } from "@/lib/league/use-league-account";
import { LEAGUE_EMOJIS } from "@/lib/league/emoji";
import { TEXT_BUTTON } from "./copy";
import { EmailForm } from "./EmailForm";
import { ProfileForm } from "./ProfileForm";

export interface JoinFlowProps {
  account: UseLeagueAccount;
}

function randomEmoji(): string {
  return LEAGUE_EMOJIS[Math.floor(Math.random() * LEAGUE_EMOJIS.length)];
}

/**
 * Not joined (status `none` or `offline`): pick nickname + emoji and join, or sign in with the
 * email of an account made on another device.
 */
export function JoinFlow({ account }: JoinFlowProps) {
  // Only rendered on the client after the account check (never server-rendered): random is safe.
  const [initialEmoji] = useState(randomEmoji);
  const online = account.status !== "offline" && account.online;

  return (
    <>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Únete a la Liga</h2>
          <p className="text-base text-ink-muted">
            Elige un apodo y un emoji. Es lo único que verán los demás: ni tu nombre ni tu email. Solo cuenta la
            experiencia que ganes a partir de hoy.
          </p>
        </div>
        <ProfileForm
          initialEmoji={initialEmoji}
          submitLabel="Unirme a la Liga"
          pendingLabel="Uniéndote…"
          onSubmit={async (nickname, emoji) => {
            await account.join(nickname, emoji);
          }}
          online={online}
        />
      </Card>

      <SignInWithEmail account={account} online={online} />
    </>
  );
}

/** "Entrar con mi email": magic link to an account that already has a linked email. */
function SignInWithEmail({ account, online }: { account: UseLeagueAccount; online: boolean }) {
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-ink">¿Ya estás en la Liga en otro móvil?</h2>
        <p className="text-sm text-ink-muted">
          Si vinculaste tu email, entra con él y recupera tu apodo y tu experiencia. Te enviaremos un enlace: ábrelo en
          este dispositivo.
        </p>
      </div>
      {sentTo ? (
        <div role="status" className="flex flex-col gap-2 rounded-button bg-sea-soft px-4 py-3">
          <p className="text-base font-bold text-ink">Revisa tu correo</p>
          <p className="text-sm text-ink">
            Te hemos enviado un enlace a <strong className="break-words">{sentTo}</strong>. Ábrelo en este dispositivo
            para entrar.
          </p>
          <button
            type="button"
            className={TEXT_BUTTON}
            onClick={() => {
              setSentTo(null);
              setOpen(true);
            }}
          >
            Usar otro email
          </button>
        </div>
      ) : open ? (
        <EmailForm
          label="Tu email"
          submitLabel="Enviarme el enlace"
          onSubmit={account.signInWithEmail}
          onSent={(email) => {
            setSentTo(email);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          online={online}
        />
      ) : (
        <Button variant="secondary" size="md" fullWidth onClick={() => setOpen(true)}>
          Entrar con mi email
        </Button>
      )}
    </Card>
  );
}
