import { useEffect, useRef } from "react";
import { shouldTriggerNotification } from "../lib/settlement";
import type { ParticipantDoc } from "../lib/firestore";
import type { Participant } from "../lib/settlement";

const COOLDOWN = 30 * 60 * 1000; // 30분

export function useNotification(
  participants: (ParticipantDoc & { id: string })[],
  currentParticipantId: string | null,
  onNotify: (name: string) => void,
) {
  const lastNotified = useRef<Record<string, number>>({});

  useEffect(() => {
    if (participants.length < 2) return;

    const mapped: Participant[] = participants.map((p) => ({
      id: p.id,
      name: p.name,
      soju: p.soju,
      beer: p.beer,
      isKkakdugi: p.isKkakdugi,
      status: p.status,
      lastTapAt: null,
    }));

    for (const p of mapped) {
      if (p.isKkakdugi || p.status === "left") continue;
      if (p.id === currentParticipantId) continue;

      const now = Date.now();
      const last = lastNotified.current[p.id] ?? 0;
      if (now - last < COOLDOWN) continue;

      if (shouldTriggerNotification(p.id, mapped)) {
        lastNotified.current[p.id] = now;
        onNotify(p.name);
      }
    }
  }, [participants]);
}
