import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinRoom } from "../lib/firestore";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useRoom } from "../hooks/useRoom";

export default function JoinPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, loading: roomLoading } = useRoom(roomId!);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setParticipantId] = useLocalStorage<string | null>(
    `participant-${roomId}`,
    null,
  );

  // 종료된 방은 정산 결과로 리다이렉트
  if (!roomLoading && room?.status === "closed") {
    navigate(`/room/${roomId}/result`, { replace: true });
    return null;
  }

  async function handleJoin() {
    if (!name.trim() || !roomId) return;
    setLoading(true);
    try {
      const participantId = await joinRoom(roomId, name.trim());
      setParticipantId(participantId);
      navigate(`/room/${roomId}`);
    } catch (e) {
      console.error(e);
      alert("참여에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-16 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">🍶 잔잔바라</h1>
        <p className="text-gray-400 text-sm">술자리에 참여합니다</p>
      </div>
      <div className="w-full max-w-xs space-y-4">
        <input
          type="text"
          placeholder="이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          maxLength={10}
          className="w-full py-4 px-4 bg-gray-800 rounded-xl text-white text-center text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          autoFocus
        />
        <button
          onClick={handleJoin}
          disabled={!name.trim() || loading}
          className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-2xl text-xl font-bold text-black transition-colors"
        >
          {loading ? "참여 중..." : "참여하기"}
        </button>
      </div>
    </div>
  );
}
