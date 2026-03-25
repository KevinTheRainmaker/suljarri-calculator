import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toPng } from "html-to-image";
import {
  Receipt,
  ClipboardText,
  Camera,
  ShareNetwork,
} from "@phosphor-icons/react";
import { getSettlement } from "../lib/firestore";
import { useRoom } from "../hooks/useRoom";

export default function ResultPage() {
  const { roomId } = useParams<{ roomId: string }>()!;
  const { participants } = useRoom(roomId!);
  const [settlement, setSettlement] = useState<{
    sojuTotal: number;
    beerTotal: number;
    result: Record<string, number>;
  } | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSettlement(roomId!).then(setSettlement);
  }, [roomId]);

  async function handleSaveImage() {
    if (!receiptRef.current) return;
    const dataUrl = await toPng(receiptRef.current, {
      backgroundColor: "#1f2937",
    });
    const link = document.createElement("a");
    link.download = "잔잔바라_정산.png";
    link.href = dataUrl;
    link.click();
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "잔잔바라 정산 결과", url });
    } else {
      navigator.clipboard.writeText(url);
      alert("링크가 복사되었습니다!");
    }
  }

  function handleCopyText() {
    if (!settlement) return;
    const sorted = Object.entries(settlement.result).sort(
      ([, a], [, b]) => b - a,
    );
    const lines = sorted.map(([id, amount]) => {
      const p = participantMap[id];
      const name = p?.name ?? id;
      const drinks = p ? ` (🍶${p.soju} 🍺${p.beer})` : "";
      return `${name}${drinks}: ${amount.toLocaleString()}원`;
    });
    const total = (
      settlement.sojuTotal + settlement.beerTotal
    ).toLocaleString();
    const text = [
      "🍶 잔잔바라 정산 결과",
      `소주 ${settlement.sojuTotal.toLocaleString()}원 / 맥주 ${settlement.beerTotal.toLocaleString()}원`,
      "",
      ...lines,
      "",
      `총 ${total}원`,
      "",
      "잔잔바라로 공정하게 정산했어요 🍻",
    ].join("\n");
    navigator.clipboard.writeText(text);
    alert("정산 내역이 복사되었습니다!");
  }

  if (!settlement)
    return (
      <div className="flex items-center justify-center min-h-screen">
        정산 결과 로딩 중...
      </div>
    );

  const participantMap = Object.fromEntries(participants.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-24 min-h-screen">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <Receipt size={26} weight="bold" /> 정산 결과
      </h1>
      <p className="text-gray-400 text-sm mb-6">마신 만큼, 딱 그만큼</p>

      {/* 영수증 (캡처 대상) */}
      <div
        ref={receiptRef}
        className="w-full max-w-md bg-gray-800 rounded-2xl p-5 mb-4"
      >
        <div className="text-center mb-4">
          <p className="font-bold text-lg">🍶 잔잔바라</p>
          <p className="text-xs text-gray-400">
            소주 {settlement.sojuTotal.toLocaleString()}원 / 맥주{" "}
            {settlement.beerTotal.toLocaleString()}원
          </p>
        </div>
        <div className="border-t border-gray-600 pt-4 space-y-3">
          {Object.entries(settlement.result)
            .sort(([, a], [, b]) => b - a)
            .map(([id, amount]) => {
              const p = participantMap[id];
              return (
                <div key={id} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{p?.name ?? id}</span>
                    {p && (
                      <span className="text-xs text-gray-400 ml-2">
                        🍶{p.soju} 🍺{p.beer}
                      </span>
                    )}
                    {p?.status === "left" && (
                      <span className="text-xs text-gray-500 ml-1">(귀가)</span>
                    )}
                  </div>
                  <span className="font-bold text-amber-400">
                    {amount.toLocaleString()}원
                  </span>
                </div>
              );
            })}
        </div>
        <div className="border-t border-gray-600 mt-4 pt-3 text-center">
          <p className="text-xs text-gray-500">
            잔잔바라로 공정하게 정산했어요 🍻
          </p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="w-full max-w-md space-y-2">
        <button
          onClick={handleCopyText}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-black"
        >
          <ClipboardText size={18} weight="bold" className="inline mr-1" />
          정산 내역 복사
        </button>
        <button
          onClick={handleSaveImage}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium"
        >
          <Camera size={18} weight="bold" className="inline mr-1" />
          이미지 저장
        </button>
        <button
          onClick={handleShare}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium"
        >
          <ShareNetwork size={18} weight="bold" className="inline mr-1" />
          링크 공유
        </button>
      </div>
    </div>
  );
}
