# Product brief — personal language trainer (Italian first)

Decided with Hernán on 2026-09-30. Every task reads this before starting.

## Learner
- Native Spanish speaker. UI copy, explanations and translations are in **Spain Spanish, using "tú"**
  ("Toca para escuchar", "¡Genial!").
- Italian level: **knows the basics (A1)**: greetings, thanks, numbers, a few loose phrases.
- Trip to **Sicily in less than 2 weeks**. About 15–20 minutes a day. Urgent, practical mode:
  survival phrases and typical answers first, no grammar for its own sake.
- Goal: **oral communication**. Understand what Italians say and answer them.
- Phone: **iPhone, using Chrome** (WebKit engine). Consequences:
  - Web Speech recognition is probably unavailable in Chrome on iOS: feature-detect and fall
    back to self-evaluation. Never make a lesson impossible without a microphone.
  - Audio must start from a user gesture (iOS autoplay rules).
  - PWA install is "Share → Add to Home Screen" (iOS 16.4+ in Chrome).

## Content priorities (in this order)
1. **Getting around by train and bus**: Trenitalia regional trains, intercity buses (AST, SAIS,
   Interbus), tickets, validating ("convalidare/obliterare"), platforms ("binario"), delays,
   strikes ("sciopero"), airport buses (Palermo: Prestia e Comandè; Catania: Alibus), taxis and
   asking for directions on foot in Palermo, Catania and Siracusa. No car, no ferries.
2. **Talking with Italians**: introducing yourself, where you are from, what you do, small talk,
   understanding the typical questions and answering them. Use a **generic traveller persona**
   kept in one clearly marked file so Hernán can edit it later.
3. **Survival basics**: greetings, courtesy, numbers, prices, time, "I don't understand / slower
   please", emergencies and pharmacy.
4. **Basic food**: short unit: bar (caffè, cornetto, granita e brioche, arancini), restaurant
   (table, ordering, allergies, the bill).
5. **Sicilian expressions**: recognition only (words he will hear), not for production.
6. **Minimal grammar cards**: tu vs Lei, "vorrei", present tense of essere, avere, volere,
   potere, andare.

Register: **Lei** with strangers and staff, **tu** with peers. Mark each phrase's register.

## Volume (this plan)
About **400 phrases + 300 vocabulary words**, 8–10 units, ~40 lessons, 10–12 dialogues.

## App sections
- **Path** (home): units by situation, short ~5-minute lessons, Duolingo-like.
- **Review**: spaced repetition of what he got wrong or is about to forget.
- **Phrasebook**: fast search by situation, for use during the trip; tap to play aloud, big
  "show it to the Italian" mode.
- **Dialogues**: scripted conversations; the Italian says something (audio), he picks or says
  the answer.
- **Profile**: XP, streak, settings.
- **Placement test** at first launch: ~12 questions, ~3 minutes, marks mastered lessons done.

## Exercise types (mixed inside each lesson)
- Understand what I hear: listen to Italian audio and pick the meaning; dictation.
- Build phrases: Spanish → Italian with word tiles, fill the gap.
- Answer: a typical question ("Di dove sei?", "Biglietto?") and pick or say the right reply.
- Vocabulary and voice: match Italian–Spanish pairs; say the phrase aloud (speech recognition
  when available, otherwise self-evaluation).

## Gamification and storage
Streak + XP. **No lives.** Progress stored on the device (localStorage). No accounts, no server.

## Audio
- Pre-generated **neural mp3** with edge-tts Italian voices (e.g. it-IT-ElsaNeural,
  it-IT-DiegoNeural, it-IT-IsabellaNeural), committed under `public/audio/<lang>/`.
- Browser `speechSynthesis` (it-IT) as a fallback for anything without an mp3.
- Slow mode (reduced playback rate).

## Visual style
Own **Sicilian identity**: lemon yellow, sea blue, terracotta; big rounded buttons, success and
error animations. Duolingo-like mechanics, not a Duolingo clone.

## Platform
- Next.js (App Router), TypeScript strict, Tailwind, **static export** (no server runtime, no API
  keys). Mobile-first, centred mobile column on desktop.
- **Installable PWA that works offline** (plane, metro). Hernán deploys to Vercel himself.
- **Language-agnostic code**: content lives in `content/<lang>/`; only Italian (`it`) exists now.
  Adding a language means adding content, not changing code.
