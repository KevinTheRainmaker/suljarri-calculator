import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";
import { saveSettlement } from "../lib/firestore";
import { calculateSettlement } from "../lib/settlement";
import type { Participant } from "../lib/settlement";

export default function SettlePage() {
  const { roomId } = useParams<{ roomId: string }>()!;
  const navigate = useNavigate();
  const { participants } = useRoom(roomId!);
  const [sojuTotal, setSojuTotal] = useState("");
  const [beerTotal, setBeerTotal] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSettle() {
    const soju = parseInt(sojuTotal) || 0;
    const beer = parseInt(beerTotal) || 0;
    if (soju === 0 && beer === 0) {
      alert("소주 또는 맥주 금액을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const mapped: Participant[] = participants.map((p) => ({
        id: p.id,
        name: p.name,
        soju: p.soju,
        beer: p.beer,
        isKkakdugi: p.isKkakdugi,
        status: p.status,
        lastTapAt: null,
      }));
      const result = calculateSettlement(mapped, soju, beer);
      await saveSettlement(roomId!, soju, beer, result);
      navigate(`/room/${roomId}/result`);
    } catch (e) {
      console.error(e);
      alert("정산 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-16 px-4">
      <h1 className="text-2xl font-bold mb-2">정산 금액 입력</h1>
      <p className="text-gray-400 text-sm mb-8">
        영수증의 주종별 금액을 입력하세요
      </p>

      <div className="w-full max-w-xs space-y-4 mb-8">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            🍶 소주 총액 (원)
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={sojuTotal}
            onChange={(e) => setSojuTotal(e.target.value)}
            className="w-full py-4 px-4 bg-gray-800 rounded-xl text-white text-right text-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            🍺 맥주 총액 (원)
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={beerTotal}
            onChange={(e) => setBeerTotal(e.target.value)}
            className="w-full py-4 px-4 bg-gray-800 rounded-xl text-white text-right text-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      <button
        onClick={handleSettle}
        disabled={loading}
        className="w-full max-w-xs py-5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-2xl text-xl font-bold text-black"
      >
        {loading ? "계산 중..." : "정산하기 🧮"}
      </button>
    </div>
  );
}
