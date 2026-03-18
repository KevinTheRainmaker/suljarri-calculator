import type { ParticipantDoc } from "../lib/firestore";

interface Props {
  participants: (ParticipantDoc & { id: string })[];
  isHost: boolean;
  onToggleKkakdugi: (id: string, current: boolean) => void;
}

export default function Leaderboard({
  participants,
  isHost,
  onToggleKkakdugi,
}: Props) {
  const sorted = [...participants].sort(
    (a, b) => b.soju + b.beer - (a.soju + a.beer),
  );

  return (
    <div className="w-full max-w-md space-y-2">
      {sorted.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center justify-between px-4 py-3 rounded-xl ${
            p.status === "left" ? "bg-gray-800 opacity-50" : "bg-gray-800"
          } ${p.isKkakdugi ? "border border-amber-500/50" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-5 text-sm">{i + 1}</span>
            <div>
              <span className="font-medium">{p.name}</span>
              {p.status === "left" && (
                <span className="text-xs text-gray-500 ml-1">(귀가)</span>
              )}
              {p.isKkakdugi && (
                <span className="text-xs text-amber-400 ml-1">(깍두기)</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">
              🍶{p.soju} 🍺{p.beer}
            </span>
            {isHost && p.status !== "left" && (
              <button
                onClick={() => onToggleKkakdugi(p.id, p.isKkakdugi)}
                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                {p.isKkakdugi ? "깍두기 해제" : "깍두기"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
