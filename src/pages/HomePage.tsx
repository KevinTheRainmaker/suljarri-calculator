import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../lib/firestore";
import { useLocalStorage } from "../hooks/useLocalStorage";

export default function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [, setHostId] = useLocalStorage<string | null>("hostId", null);

  async function handleCreate() {
    setLoading(true);
    try {
      const hostId = crypto.randomUUID();
      setHostId(hostId);
      const roomId = await createRoom(hostId);
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
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full max-w-xs py-5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-2xl text-xl font-bold text-black transition-colors"
      >
        {loading ? "방 만드는 중..." : "🍺 술자리 시작"}
      </button>
      <p className="mt-6 text-gray-500 text-xs text-center">
        링크 하나로 공유 · 설치 불필요 · 로그인 없음
      </p>
    </div>
  );
}
