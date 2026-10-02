"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { UseLeagueAccount } from "@/lib/league/use-league-account";
import { ConfirmDialog } from "./ConfirmDialog";
import { DANGER, leagueErrorMessage, TEXT_BUTTON } from "./copy";
import { EmailForm } from "./EmailForm";

export interface AccountSectionProps {
  account: UseLeagueAccount;
  /** Called after "Salir de la Liga y borrar mis datos" succeeded. */
  onDeleted: () => void;
}

const OFFLINE_NOTE = "Sin conexión. Conéctate a internet para hacerlo.";

/** Joined: email link (keep the account on another device), sign out and delete my data. */
export function AccountSection({ account, onDeleted }: AccountSectionProps) {
  const [dialog, setDialog] = useState<"delete" | "signout" | null>(null);

  return (
    <section aria-labelledby="league-account-title" className="flex flex-col gap-3">
      <h2 id="league-account-title" className="text-2xl font-extrabold tracking-tight text-ink">
        Tu cuenta
      </h2>

      <EmailCard account={account} onSignOut={() => setDialog("signout")} />

      <Card tone="terracotta" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-ink">Salir de la Liga</h3>
          <p className="text-sm text-ink">
            Borra tu apodo, tu grupo y tu experiencia de la Liga. Tu progreso en este móvil no se toca.
          </p>
        </div>
        <button type="button" onClick={() => setDialog("delete")} className={cn(DANGER, "min-h-12 py-2 text-base")}>
          Salir de la Liga y borrar mis datos
        </button>
      </Card>

      {dialog === "delete" ? (
        <ConfirmDialog
          title="¿Salir de la Liga?"
          confirmLabel="Sí, borrar mis datos"
          pendingLabel="Borrando…"
          blockedNote={account.online ? undefined : OFFLINE_NOTE}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await account.deleteMe();
            setDialog(null);
            onDeleted();
          }}
        >
          <p>
            Borraremos tu apodo, tu grupo y toda tu experiencia de la Liga. No se puede deshacer, y dejarás de aparecer
            en la clasificación.
          </p>
          <p>Tus lecciones, tu racha y tu XP en este móvil se quedan como están.</p>
        </ConfirmDialog>
      ) : null}

      {dialog === "signout" ? (
        <ConfirmDialog
          title="¿Cerrar sesión en este móvil?"
          confirmLabel="Cerrar sesión"
          pendingLabel="Cerrando sesión…"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await account.signOut();
            setDialog(null);
          }}
        >
          <p>
            Tu cuenta sigue en la Liga. Para volver, usa «Entrar con mi email» con{" "}
            <strong className="break-words text-ink">{account.email}</strong>.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

/** Email states: none (explain + link), pending (check your inbox) and linked. */
function EmailCard({ account, onSignOut }: { account: UseLeagueAccount; onSignOut: () => void }) {
  const [changing, setChanging] = useState(false);
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [resendError, setResendError] = useState("");

  const pending = account.pendingEmail;
  const linked = account.email;

  if (pending && !changing) {
    const sendAgain = async () => {
      setResend("sending");
      try {
        await account.linkEmail(pending);
        setResend("sent");
      } catch (error) {
        setResendError(leagueErrorMessage(error));
        setResend("failed");
      }
    };
    return (
      <Card tone="sea" className="flex flex-col gap-3">
        <div role="status" className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-ink">Revisa tu correo</h3>
          <p className="text-sm text-ink">
            Te hemos enviado un enlace a <strong className="break-words">{pending}</strong>. Ábrelo en este dispositivo
            para terminar de vincular tu email.
          </p>
        </div>
        {resend === "sent" ? (
          <p role="status" className="text-sm font-bold text-ink">
            Enlace reenviado.
          </p>
        ) : resend === "failed" ? (
          <p role="alert" className="text-sm font-bold text-error-deep">
            {resendError}
          </p>
        ) : null}
        {!account.online ? (
          <p role="status" className="text-sm font-bold text-terracotta-deep">
            {OFFLINE_NOTE}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-4">
          <button
            type="button"
            className={TEXT_BUTTON}
            onClick={sendAgain}
            disabled={!account.online || resend === "sending"}
          >
            {resend === "sending" ? "Reenviando…" : "Reenviar enlace"}
          </button>
          <button
            type="button"
            className={TEXT_BUTTON}
            onClick={() => {
              setResend("idle");
              setChanging(true);
            }}
          >
            Usar otro email
          </button>
        </div>
      </Card>
    );
  }

  if (linked && !changing) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-ink">Email vinculado</h3>
          <p className="break-words text-base font-bold text-ink">{linked}</p>
          <p className="text-sm text-ink-muted">
            En otro móvil, entra con «Entrar con mi email» y recuperarás tu cuenta. Nadie más ve tu email.
          </p>
        </div>
        <Button variant="secondary" size="md" fullWidth onClick={onSignOut}>
          Cerrar sesión en este móvil
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">{changing ? "Cambiar email" : "Vincular email"}</h3>
        <p className="text-sm text-ink-muted">
          {changing
            ? "Te enviaremos un enlace al nuevo email. Ábrelo en este dispositivo para confirmarlo."
            : "Si cambias de móvil o borras los datos del navegador, sin email perderías tu cuenta de la Liga. Te enviaremos un enlace: ábrelo en este dispositivo y quedará vinculado. Nadie más verá tu email."}
        </p>
      </div>
      <EmailForm
        label="Tu email"
        submitLabel="Enviar enlace"
        onSubmit={account.linkEmail}
        onSent={() => setChanging(false)}
        onCancel={changing ? () => setChanging(false) : undefined}
        online={account.online}
      />
    </Card>
  );
}
