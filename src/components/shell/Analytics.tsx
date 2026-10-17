"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics: page views per page and per address (old and new, to follow the move),
 * no cookies. Only the address and path are sent: the query and hash are dropped (they can carry
 * ids and the Liga's sign-in tokens). Offline, nothing is sent.
 */
function pathOnly(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={pathOnly} />;
}
