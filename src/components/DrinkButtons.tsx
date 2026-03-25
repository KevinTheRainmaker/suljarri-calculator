import { useState } from "react";
import { Hourglass } from "@phosphor-icons/react";
import { updateDrinkCount } from "../lib/firestore";

interface Props {
  roomId: string;
  participantId: string;
  soju: number;
  beer: number;
  onLeave?: () => void;
}

const RATE_LIMIT_MS = 10_000;

export default function DrinkButtons({
  roomId,
  participantId,
  soju,
  beer,
  onLeave,
}: Props) {
  const [lastTap, setLastTap] = useState<Record<string, number>>({});
  const [cooldown, setCooldown] = useState<Record<string, boolean>>({});

  async function handleTap(type: "soju" | "beer", delta: number) {
    const now = Date.now();
    if (delta > 0 && cooldown[type]) return;

    if (delta > 0) {
      const last = lastTap[type] ?? 0;
      if (now - last < RATE_LIMIT_MS) return;
      setLastTap((prev) => ({ ...prev, [type]: now }));
      setCooldown((prev) => ({ ...prev, [type]: true }));
      setTimeout(
        () => setCooldown((prev) => ({ ...prev, [type]: false })),
        RATE_LIMIT_MS,
      );
    }

    const current = type === "soju" ? soju : beer;
    await updateDrinkCount(roomId, participantId, type, delta, current);
  }

  return (
    <div className="w-full max-w-xs space-y-4 pb-20">
      {/* 소주 */}
      <div className="bg-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">🍶 소주</span>
          <span className="text-3xl font-bold">{soju}잔</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleTap("soju", -1)}
            className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-xl font-bold"
          >
            −1
          </button>
          <button
            onClick={() => handleTap("soju", 1)}
            disabled={cooldown["soju"]}
            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-xl text-xl font-bold transition-colors"
          >
            {cooldown["soju"] ? (
              <Hourglass size={20} className="inline" />
            ) : (
              "+1 마셨다!"
            )}
          </button>
        </div>
      </div>

      {/* 맥주 */}
      <div className="bg-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">🍺 맥주</span>
          <span className="text-3xl font-bold">{beer}잔</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleTap("beer", -1)}
            className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-xl font-bold"
          >
            −1
          </button>
          <button
            onClick={() => handleTap("beer", 1)}
            disabled={cooldown["beer"]}
            className="flex-[2] py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-xl text-xl font-bold transition-colors"
          >
            {cooldown["beer"] ? (
              <Hourglass size={20} className="inline" />
            ) : (
              "+1 마셨다!"
            )}
          </button>
        </div>
      </div>

      {/* 중도 하차 (방장에게는 표시 안 함) */}
      {onLeave && (
        <button
          onClick={onLeave}
          className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm underline"
        >
          귀가할게요 (중도 하차)
        </button>
      )}
    </div>
  );
}
