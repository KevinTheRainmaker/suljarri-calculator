import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useNotification } from "../hooks/useNotification";
import type { ToastEvent } from "../lib/firestore";
import {
  toggleKkakdugi,
  leaveRoom,
  closeRoom,
  toastAll,
} from "../lib/firestore";
import { QrCode, Eye, Hourglass, FlagCheckered } from "@phosphor-icons/react";
import Leaderboard from "../components/Leaderboard";
import DrinkButtons from "../components/DrinkButtons";
import QRShareModal from "../components/QRShareModal";
import ToastOverlay from "../components/ToastOverlay";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()!;
  const navigate = useNavigate();
  const { room, participants, loading } = useRoom(roomId!);
  const [hostId] = useLocalStorage<string | null>("hostId", null);
  const [participantId] = useLocalStorage<string | null>(
    `participant-${roomId}`,
    null,
  );
  const [showQR, setShowQR] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [toastCooldown, setToastCooldown] = useState(false);
  const [toastEffect, setToastEffect] = useState<ToastEvent | null>(null);
  const lastToastRef = useRef<number>(0);

  const handleNotify = useCallback((name: string) => {
    setNotification(name);
    setTimeout(() => setNotification(null), 5000);
  }, []);

  useNotification(participants, participantId, handleNotify);

  // 건배 이벤트 감지 → 오버레이 표시
  useEffect(() => {
    const toast = room?.lastToast;
    if (!toast || toast.at <= lastToastRef.current) return;
    lastToastRef.current = toast.at;
    setToastEffect({ ...toast });
    const timer = setTimeout(() => setToastEffect(null), 2600);
    return () => clearTimeout(timer);
  }, [room?.lastToast]);

  const isHost = room?.hostId === hostId;
  const me = participants.find((p) => p.id === participantId);
  const joinUrl = `${window.location.origin}/room/${roomId}/join`;

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        로딩 중...
      </div>
    );
  if (!room)
    return (
      <div className="flex items-center justify-center min-h-screen">
        방을 찾을 수 없습니다
      </div>
    );

  // 종료된 방은 정산 결과로 리다이렉트
  if (room.status === "closed") {
    navigate(`/room/${roomId}/result`, { replace: true });
    return null;
  }

  // 참여자가 없으면 (총무만 있거나, 새로운 참여자) join 페이지로
  if (!isHost && !me) {
    navigate(`/room/${roomId}/join`);
    return null;
  }

  async function handleLeave() {
    if (!participantId || !roomId) return;
    if (!confirm("귀가하시겠어요? 마신 잔수는 정산에 포함됩니다.")) return;
    await leaveRoom(roomId, participantId);
  }

  async function handleClose() {
    if (!roomId) return;
    if (!confirm("술자리를 종료하고 정산하시겠어요?")) return;
    await closeRoom(roomId);
    navigate(`/room/${roomId}/settle`);
  }

  async function handleToggleKkakdugi(id: string, current: boolean) {
    if (!roomId) return;
    await toggleKkakdugi(roomId, id, !current);
  }

  async function handleToast(type: "soju" | "beer") {
    if (toastCooldown || !roomId) return;
    setToastCooldown(true);
    await toastAll(roomId, type, participants);
    setTimeout(() => setToastCooldown(false), 10_000);
  }

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-20 min-h-screen">
      {/* 헤더 */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <h1 className="font-bold text-lg">🍶 잔잔바라</h1>
        <button
          onClick={() => setShowQR(true)}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          <QrCode size={16} weight="bold" className="inline mr-1" />
          초대
        </button>
      </div>

      {/* 노티 배너 */}
      {notification && (
        <div className="w-full max-w-md mb-4 px-4 py-3 bg-yellow-500/20 border border-yellow-500/50 rounded-xl text-center text-sm">
          <Eye size={14} weight="bold" className="inline mr-1" />
          <strong>{notification}</strong>님, 진짜 안마시고 있음?
        </div>
      )}

      {/* 리더보드 */}
      <div className="w-full max-w-md mb-6">
        <h2 className="text-sm text-gray-400 mb-2">현재 기록</h2>
        <Leaderboard
          participants={participants}
          isHost={isHost}
          onToggleKkakdugi={handleToggleKkakdugi}
        />
      </div>

      {/* 내 음주 기록 버튼 (참여자 & 방장 모두) */}
      {me && me.status === "active" && (
        <DrinkButtons
          roomId={roomId!}
          participantId={participantId!}
          soju={me.soju}
          beer={me.beer}
          onLeave={isHost ? undefined : handleLeave}
        />
      )}

      {me && me.status === "left" && (
        <p className="text-gray-500 text-sm">
          귀가 처리되었습니다. 정산에는 포함됩니다.
        </p>
      )}

      {/* 총무 전용: 술자리 종료 */}
      {isHost && (
        <div className="w-full max-w-xs mt-4 space-y-2">
          <button
            onClick={() => setShowQR(true)}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
          >
            QR / 링크 공유
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleToast("soju")}
              disabled={toastCooldown}
              className="flex-1 py-3 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 rounded-xl text-sm font-medium"
            >
              {toastCooldown ? (
                <Hourglass size={16} className="inline" />
              ) : (
                "🍶 건배"
              )}
            </button>
            <button
              onClick={() => handleToast("beer")}
              disabled={toastCooldown}
              className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-600 rounded-xl text-sm font-medium"
            >
              {toastCooldown ? (
                <Hourglass size={16} className="inline" />
              ) : (
                "🍺 건배"
              )}
            </button>
          </div>
          <button
            onClick={handleClose}
            className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold"
          >
            <FlagCheckered size={18} weight="fill" className="inline mr-1" />
            술자리 종료 & 정산
          </button>
        </div>
      )}

      {showQR && (
        <QRShareModal url={joinUrl} onClose={() => setShowQR(false)} />
      )}

      {/* 건배 이펙트 */}
      {toastEffect && (
        <ToastOverlay key={toastEffect.at} type={toastEffect.type} />
      )}
    </div>
  );
}
