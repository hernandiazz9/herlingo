/**
 * Sends an episode's mp3 to a Telegram chat (Bot API `sendAudio`). The bot token and chat id come
 * from a JSON file `{"telegram": {"bot_token", "chat_id"}}` (--telegram-config) or from
 * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID; the token is never printed.
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { TOPIC_LABEL } from "./audio";
import type { ListeningEpisode } from "./schema";
import type { Store } from "./state";

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export function telegramConfig(file?: string): TelegramConfig {
  if (file) {
    const cfg = (JSON.parse(readFileSync(file, "utf8")) as { telegram?: { bot_token?: string; chat_id?: string | number } })
      .telegram;
    if (cfg?.bot_token && cfg.chat_id) return { token: cfg.bot_token, chatId: String(cfg.chat_id) };
    throw new Error(`No telegram.bot_token / telegram.chat_id in ${file}`);
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) return { token, chatId };
  throw new Error("Telegram not configured: --telegram-config <file> or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.");
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export async function sendEpisode(config: TelegramConfig, store: Store, episode: ListeningEpisode): Promise<void> {
  if (!episode.audio) throw new Error(`${episode.id} has no mp3`);
  const path = join(store.dir, episode.audio.file);
  const label = TOPIC_LABEL[episode.topic];
  const caption = `🎧 ${label} ${episode.number} · ${episode.title}\n${episode.description}\n${mmss(episode.audio.seconds)} · ${episode.level}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const form = new FormData();
    form.set("chat_id", config.chatId);
    form.set("title", `${label} ${episode.number} · ${episode.title}`);
    form.set("performer", "Herlingo Listening");
    form.set("duration", String(Math.round(episode.audio.seconds)));
    form.set("caption", caption);
    form.set("audio", new Blob([readFileSync(path)], { type: "audio/mpeg" }), basename(path));
    const res = await fetch(`https://api.telegram.org/bot${config.token}/sendAudio`, { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; parameters?: { retry_after?: number } };
    if (res.ok && body.ok) return;
    const wait = body.parameters?.retry_after;
    if (res.status === 429 && wait) {
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      continue;
    }
    throw new Error(`Telegram refused ${episode.id}: ${res.status} ${body.description ?? ""}`);
  }
  throw new Error(`Telegram kept rate-limiting ${episode.id}`);
}
