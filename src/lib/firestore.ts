import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface ToastEvent {
  type: "soju" | "beer";
  at: number;
}

export interface RoomDoc {
  hostId: string;
  status: "active" | "closed";
  createdAt: Timestamp;
  closedAt: Timestamp | null;
  deleteAt: Timestamp | null;
  lastToast?: ToastEvent | null;
}

export interface ParticipantDoc {
  name: string;
  status: "active" | "left";
  isKkakdugi: boolean;
  soju: number;
  beer: number;
  lastTapAt: Timestamp | null;
}

export interface SettlementDoc {
  sojuTotal: number;
  beerTotal: number;
  result: Record<string, number>;
}

const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
const demoRoomId = "demo-room";
const demoRoom: RoomDoc = {
  hostId: "demo-host",
  status: "active",
  createdAt: Timestamp.now(),
  closedAt: null,
  deleteAt: null,
};
let demoParticipants: (ParticipantDoc & { id: string })[] = [
  {
    id: "p1",
    name: "지민",
    status: "active",
    isKkakdugi: false,
    soju: 3,
    beer: 1,
    lastTapAt: Timestamp.now(),
  },
  {
    id: "p2",
    name: "민수",
    status: "active",
    isKkakdugi: false,
    soju: 2,
    beer: 2,
    lastTapAt: Timestamp.now(),
  },
  {
    id: "p3",
    name: "서연",
    status: "active",
    isKkakdugi: true,
    soju: 1,
    beer: 0,
    lastTapAt: Timestamp.now(),
  },
];
let demoSettlement: SettlementDoc | null = {
  sojuTotal: 30000,
  beerTotal: 20000,
  result: { 지민: 20000, 민수: 20000 },
};

// 방 생성
export async function createRoom(hostId: string): Promise<string> {
  if (isDemo) {
    demoRoom.hostId = hostId;
    return demoRoomId;
  }
  const ref = await addDoc(collection(db, "rooms"), {
    hostId,
    status: "active",
    createdAt: serverTimestamp(),
    closedAt: null,
    deleteAt: null,
  });
  return ref.id;
}

// 참여자 추가
export async function joinRoom(roomId: string, name: string): Promise<string> {
  if (isDemo) {
    const id = `demo-${Date.now()}`;
    demoParticipants = [
      ...demoParticipants,
      {
        id,
        name,
        status: "active",
        isKkakdugi: false,
        soju: 0,
        beer: 0,
        lastTapAt: Timestamp.now(),
      },
    ];
    return id;
  }
  const ref = await addDoc(collection(db, "rooms", roomId, "participants"), {
    name,
    status: "active",
    isKkakdugi: false,
    soju: 0,
    beer: 0,
    lastTapAt: null,
  } as ParticipantDoc);
  return ref.id;
}

// 잔수 업데이트 (rate limit은 클라이언트에서 처리)
export async function updateDrinkCount(
  roomId: string,
  participantId: string,
  field: "soju" | "beer",
  delta: number,
  currentCount: number,
): Promise<void> {
  const newCount = Math.max(0, currentCount + delta);
  if (isDemo) {
    demoParticipants = demoParticipants.map((p) =>
      p.id === participantId
        ? { ...p, [field]: newCount, lastTapAt: Timestamp.now() }
        : p,
    );
    return;
  }
  await updateDoc(doc(db, "rooms", roomId, "participants", participantId), {
    [field]: newCount,
    lastTapAt: serverTimestamp(),
  });
}

// 깍두기 토글
export async function toggleKkakdugi(
  roomId: string,
  participantId: string,
  isKkakdugi: boolean,
): Promise<void> {
  if (isDemo) {
    demoParticipants = demoParticipants.map((p) =>
      p.id === participantId ? { ...p, isKkakdugi } : p,
    );
    return;
  }
  await updateDoc(doc(db, "rooms", roomId, "participants", participantId), {
    isKkakdugi,
  });
}

// 중도 하차
export async function leaveRoom(
  roomId: string,
  participantId: string,
): Promise<void> {
  if (isDemo) {
    demoParticipants = demoParticipants.map((p) =>
      p.id === participantId ? { ...p, status: "left" } : p,
    );
    return;
  }
  await updateDoc(doc(db, "rooms", roomId, "participants", participantId), {
    status: "left",
  });
}

// 술자리 종료
export async function closeRoom(roomId: string): Promise<void> {
  const closedAt = Timestamp.now();
  const deleteAt = Timestamp.fromMillis(
    closedAt.toMillis() + 24 * 60 * 60 * 1000,
  );
  if (isDemo) {
    demoRoom.status = "closed";
    demoRoom.closedAt = closedAt;
    demoRoom.deleteAt = deleteAt;
    return;
  }
  await updateDoc(doc(db, "rooms", roomId), {
    status: "closed",
    closedAt,
    deleteAt,
  });
}

// 정산 결과 저장
export async function saveSettlement(
  roomId: string,
  sojuTotal: number,
  beerTotal: number,
  result: Record<string, number>,
): Promise<void> {
  if (isDemo) {
    demoSettlement = { sojuTotal, beerTotal, result };
    return;
  }
  await setDoc(doc(db, "rooms", roomId, "settlement", "result"), {
    sojuTotal,
    beerTotal,
    result,
  });
}

// 건배 (활성 참여자 전원 +1 + 이벤트 기록)
export async function toastAll(
  roomId: string,
  type: "soju" | "beer",
  participants: (ParticipantDoc & { id: string })[],
): Promise<void> {
  const active = participants.filter(
    (p) => p.status === "active" && !p.isKkakdugi,
  );
  if (isDemo) {
    demoParticipants = demoParticipants.map((p) =>
      active.find((a) => a.id === p.id)
        ? { ...p, [type]: (type === "soju" ? p.soju : p.beer) + 1 }
        : p,
    );
    return;
  }
  const updates = active.map((p) =>
    updateDoc(doc(db, "rooms", roomId, "participants", p.id), {
      [type]: (type === "soju" ? p.soju : p.beer) + 1,
    }),
  );
  // room 문서에 건배 이벤트 기록 (전원 화면에 이펙트 표시용)
  updates.push(
    updateDoc(doc(db, "rooms", roomId), {
      lastToast: { type, at: Date.now() },
    }),
  );
  await Promise.all(updates);
}

// 실시간 참여자 구독 (리더보드 — 잔수 합계만 동기화)
export function subscribeParticipants(
  roomId: string,
  callback: (participants: (ParticipantDoc & { id: string })[]) => void,
) {
  if (isDemo) {
    callback(demoParticipants);
    return () => {};
  }
  return onSnapshot(collection(db, "rooms", roomId, "participants"), (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as ParticipantDoc) })),
    );
  });
}

// 방 상태 구독
export function subscribeRoom(
  roomId: string,
  callback: (room: RoomDoc | null) => void,
) {
  if (isDemo) {
    callback(demoRoom);
    return () => {};
  }
  return onSnapshot(doc(db, "rooms", roomId), (snap) => {
    callback(snap.exists() ? (snap.data() as RoomDoc) : null);
  });
}

// 정산 결과 조회
export async function getSettlement(
  roomId: string,
): Promise<SettlementDoc | null> {
  if (isDemo) {
    return demoSettlement;
  }
  const snap = await getDoc(doc(db, "rooms", roomId, "settlement", "result"));
  return snap.exists() ? (snap.data() as SettlementDoc) : null;
}
