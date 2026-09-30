"""edge-tts worker for `npm run audio` (scripts/audio/generate.ts). Not meant to be run by hand.

Reads a JSON list of jobs `[{"text", "voice", "out"}]` from stdin and writes each mp3 to `out`
(atomically, via `out.part`). Needs internet. Exits 1 if any job still fails after retries.
"""
import asyncio
import json
import os
import sys

import edge_tts

CONCURRENCY = 6
RETRIES = 4


async def generate(job, sem):
    tmp = job["out"] + ".part"
    err = None
    async with sem:
        for attempt in range(RETRIES):
            try:
                await edge_tts.Communicate(job["text"], job["voice"]).save(tmp)
                if os.path.getsize(tmp) == 0:
                    raise RuntimeError("empty audio")
                os.replace(tmp, job["out"])
                return True
            except Exception as e:  # network hiccups, throttling
                err = e
                await asyncio.sleep(1.5 * (attempt + 1))
    if os.path.exists(tmp):
        os.remove(tmp)
    print(f"  x {job['voice']} {job['text']!r}: {err}", file=sys.stderr)
    return False


async def main():
    jobs = json.load(sys.stdin)
    sem = asyncio.Semaphore(CONCURRENCY)
    state = {"done": 0, "failed": 0}

    async def run(job):
        ok = await generate(job, sem)
        state["done"] += 1
        state["failed"] += 0 if ok else 1
        if state["done"] % 25 == 0 or state["done"] == len(jobs):
            print(f"  {state['done']}/{len(jobs)}", flush=True)

    await asyncio.gather(*(run(j) for j in jobs))
    return 1 if state["failed"] else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
