"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LANG } from "@/lib/content";
import {
  clearLeagueLinkError,
  deleteLeagueAccount,
  getLeagueAccount,
  getServerLeagueAccount,
  joinLeague,
  linkLeagueEmail,
  refreshLeagueAccount,
  signInLeagueWithEmail,
  signOutLeague,
  startLeagueAccount,
  subscribeLeagueAccount,
  updateLeagueProfile,
  type LeagueAccount,
  type LeagueProfile,
} from "./account";

export interface UseLeagueAccount extends LeagueAccount {
  /** Join (anonymous sign-in + profile). Throws `LeagueError`. */
  join: (nickname: string, emoji: string) => Promise<LeagueProfile>;
  /** Change nickname/emoji of a joined account. Throws `LeagueError`. */
  updateProfile: (nickname: string, emoji: string) => Promise<LeagueProfile>;
  /** Send the magic link that links an email to this account. Throws `LeagueError`. */
  linkEmail: (email: string) => Promise<void>;
  /** Send a magic link to sign in to an existing account on this device. Throws `LeagueError`. */
  signInWithEmail: (email: string) => Promise<void>;
  /** Sign out on this device (works offline). */
  signOut: () => Promise<void>;
  /** Delete my Liga data on the server, then sign out. Throws `LeagueError`. */
  deleteMe: () => Promise<void>;
  /** Re-check the account with the server now (never throws). */
  refresh: () => Promise<void>;
  /** Forget `linkError` once it has been shown. */
  clearLinkError: () => void;
}

const actions = {
  join: joinLeague,
  updateProfile: updateLeagueProfile,
  linkEmail: linkLeagueEmail,
  signInWithEmail: signInLeagueWithEmail,
  signOut: signOutLeague,
  deleteMe: deleteLeagueAccount,
  refresh: () => refreshLeagueAccount({ force: true }),
  clearLinkError: clearLeagueLinkError,
};

/**
 * The Liga account, live (status, profile, email) plus its actions. `status` is `loading` on the
 * server and during hydration, `disabled` when Liga is not configured. Mounting it checks the
 * session in the background (and completes a magic-link redirect to `/liga/`), without loading
 * supabase-js for users who never joined.
 */
export function useLeagueAccount(lang: string = DEFAULT_LANG): UseLeagueAccount {
  const account = useSyncExternalStore(subscribeLeagueAccount, getLeagueAccount, getServerLeagueAccount);
  useEffect(() => {
    startLeagueAccount(lang);
  }, [lang]);
  return useMemo(() => ({ ...account, ...actions }), [account]);
}
