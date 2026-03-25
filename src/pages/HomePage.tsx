import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom } from "../lib/firestore";
import { useLocalStorage } from "../hooks/useLocalStorage";

export default function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [, setHostId] = useLocalStorage<string | null>("hostId", null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const hostId = crypto.randomUUID();
      setHostId(hostId);
      const roomId = await createRoom(hostId);
      // 방장도 참여자로 등록
      const participantId = await joinRoom(roomId, trimmed);
      localStorage.setItem(
        `participant-${roomId}`,
        JSON.stringify(participantId),
      );
      navigate(`/room/${roomId}`);
    } catch (e) {
      console.error(e);
      alert("방 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2">🍶 잔잔바라</h1>
        <p className="text-gray-400 text-sm">마신 만큼, 딱 그만큼만</p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="내 이름 입력"
          maxLength={10}
          className="w-full py-4 px-4 bg-gray-800 rounded-xl text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-2xl text-xl font-bold text-black transition-colors"
        >
          {loading ? "방 만드는 중..." : "🍺 술자리 시작"}
        </button>
      </div>
      <p className="mt-6 text-gray-500 text-xs text-center">
        링크 하나로 공유 · 설치 불필요 · 로그인 없음
      </p>
    </div>
  );
}
