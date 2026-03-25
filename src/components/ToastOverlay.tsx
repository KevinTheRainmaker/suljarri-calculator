import { useEffect, useState } from "react";

interface Props {
  type: "soju" | "beer";
}

const EMOJIS = { soju: "🍶", beer: "🍺" };
const FLOAT_COUNT = 12;

export default function ToastOverlay({ type }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const emoji = EMOJIS[type];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* 중앙 텍스트 */}
      <div className="animate-toast-text text-center">
        <p className="text-6xl mb-2">{emoji}</p>
        <p className="text-3xl font-bold text-white drop-shadow-lg">건배!</p>
      </div>

      {/* 떠다니는 이모지들 */}
      {Array.from({ length: FLOAT_COUNT }).map((_, i) => (
        <span
          key={i}
          className="absolute text-4xl animate-toast-float"
          style={{
            left: `${8 + (i * 84) / FLOAT_COUNT + Math.random() * 5}%`,
            animationDelay: `${i * 0.12}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
