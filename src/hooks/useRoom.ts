import { useEffect, useState } from "react";
import { subscribeRoom, subscribeParticipants } from "../lib/firestore";
import type { RoomDoc, ParticipantDoc } from "../lib/firestore";

export function useRoom(roomId: string) {
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [participants, setParticipants] = useState<
    (ParticipantDoc & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubRoom = subscribeRoom(roomId, (r) => {
      setRoom(r);
      setLoading(false);
    });
    const unsubParticipants = subscribeParticipants(roomId, setParticipants);
    return () => {
      unsubRoom();
      unsubParticipants();
    };
  }, [roomId]);

  return { room, participants, loading };
}
