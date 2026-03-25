import { useEffect, useState } from "react";

interface Props {
  type: "soju" | "beer";
}

const EMOJIS = { soju: "🍶", beer: "🍺" };
const FLOAT_COUNT = 8;

export default function ToastOverlay({ type }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const emoji = EMOJIS[type];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* 중앙 클링크 애니메이션 */}
      <div className="flex flex-col items-center gap-6">
        {/* 건배! 텍스트: 충돌 순간 팝인 */}
        <p className="animate-gunbae-title text-8xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
          건배!
        </p>

        {/* 술잔 + 스파클 */}
        <div className="relative flex items-end justify-center">
          <span className="animate-glass-left text-7xl select-none">
            {emoji}
          </span>
          {/* 충돌 지점 스파클 */}
          <span className="animate-sparkle-pop text-4xl absolute -top-4 left-1/2 -translate-x-1/2 select-none">
            ✨
          </span>
          <span className="animate-glass-right text-7xl select-none">
            {emoji}
          </span>
        </div>
      </div>

      {/* 배경 떠다니는 이모지들 */}
      {Array.from({ length: FLOAT_COUNT }).map((_, i) => (
        <span
          key={i}
          className="absolute text-3xl animate-toast-float"
          style={{
            left: `${5 + (i * 90) / FLOAT_COUNT}%`,
            animationDelay: `${0.4 + i * 0.18}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
