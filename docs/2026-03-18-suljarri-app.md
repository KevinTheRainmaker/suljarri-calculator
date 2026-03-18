# 술자리 정산 웹앱 (잔잔바라) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 술자리 참여자들이 소주·맥주 잔 수를 원클릭 기록하고 종료 후 자동 정산하는 초경량 웹앱을 `app/` 디렉터리에 구축한다.

**Architecture:** React(Vite) + TypeScript SPA. Firestore로 참여자 잔수 합계만 실시간 동기화하고 개별 클릭 로그는 로컬 write 전용으로 분리해 동시 연결 한도를 제어한다. 순수 함수로 구현된 정산 로직을 TDD로 검증한다.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Firebase Firestore, qrcode.react, html2canvas, Vitest + Testing Library

---

## Task 1: 프로젝트 초기화

**Files:**

- Create: `app/` (Vite 프로젝트 루트)

**Step 1: Vite + React + TypeScript 프로젝트 생성**

```bash
cd C:/Users/HCIS/Desktop/git/Structural-Preservation-Eval
npm create vite@latest app -- --template react-ts
cd app
npm install
```

**Step 2: 의존성 설치**

```bash
npm install firebase qrcode.react html2canvas
npm install -D tailwindcss postcss autoprefixer vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 3: Tailwind 초기화**

```bash
npx tailwindcss init -p
```

**Step 4: `app/tailwind.config.js` 수정**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

**Step 5: `app/src/index.css` 교체**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 6: `app/vite.config.ts` 수정 (Vitest 설정 포함)**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

**Step 7: `app/src/test/setup.ts` 생성**

```ts
import "@testing-library/jest-dom";
```

**Step 8: `app/package.json` scripts에 test 추가 확인**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Step 9: 개발 서버 실행 확인**

```bash
npm run dev
```

Expected: localhost:5173 에서 Vite 기본 페이지 표시

**Step 10: Commit**

```bash
git add app/
git commit -m "chore: initialize Vite+React+TS app with Tailwind and Vitest"
```

---

## Task 2: 정산 로직 (TDD) — 핵심 비즈니스 로직

**Files:**

- Create: `app/src/lib/settlement.ts`
- Create: `app/src/test/settlement.test.ts`

**Step 1: 테스트 파일 작성**

`app/src/test/settlement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  calculateSettlement,
  getActiveParticipants,
  shouldTriggerNotification,
} from "../lib/settlement";
import type { Participant } from "../lib/settlement";

const p = (
  name: string,
  soju: number,
  beer: number,
  isKkakdugi = false,
  status: "active" | "left" = "active",
): Participant => ({
  id: name,
  name,
  soju,
  beer,
  isKkakdugi,
  status,
  lastTapAt: null,
});

describe("getActiveParticipants", () => {
  it("깍두기와 중도하차를 필터링한다", () => {
    const participants = [
      p("A", 3, 0),
      p("B", 2, 1, true), // 깍두기
      p("C", 1, 0, false, "left"), // 중도하차
    ];
    const active = getActiveParticipants(participants);
    expect(active.map((p) => p.name)).toEqual(["A"]);
  });

  it("아무도 없으면 빈 배열 반환", () => {
    expect(getActiveParticipants([])).toEqual([]);
  });
});

describe("calculateSettlement", () => {
  it("소주만 마신 경우 잔 비율로 분배", () => {
    const participants = [p("A", 3, 0), p("B", 1, 0)];
    const result = calculateSettlement(participants, 40000, 0);
    // A: 3/4 * 40000 = 30000, B: 1/4 * 40000 = 10000
    expect(result["A"]).toBe(30000);
    expect(result["B"]).toBe(10000);
  });

  it("소주+맥주 혼합 정산", () => {
    const participants = [p("A", 2, 1), p("B", 2, 1)];
    const result = calculateSettlement(participants, 20000, 14000);
    // 소주 균등 10000씩, 맥주 균등 7000씩 → 각 17000
    expect(result["A"]).toBe(17000);
    expect(result["B"]).toBe(17000);
  });

  it("깍두기는 정산에서 제외된다", () => {
    const participants = [p("A", 2, 0), p("B", 2, 0, true)];
    const result = calculateSettlement(participants, 40000, 0);
    // 깍두기 B 제외 → A만 40000
    expect(result["A"]).toBe(40000);
    expect(result["B"]).toBeUndefined();
  });

  it("중도하차는 마신 잔수 기준으로 포함된다", () => {
    const participants = [p("A", 2, 0), p("B", 2, 0, false, "left")];
    const result = calculateSettlement(participants, 40000, 0);
    // 중도하차 B도 정산 포함 (각 20000)
    expect(result["A"]).toBe(20000);
    expect(result["B"]).toBe(20000);
  });

  it("소수점은 올림 처리된다", () => {
    const participants = [p("A", 1, 0), p("B", 2, 0)];
    const result = calculateSettlement(participants, 10000, 0);
    // A: 1/3 * 10000 = 3333.3... → 3334
    // B: 2/3 * 10000 = 6666.6... → 6667
    expect(result["A"]).toBe(3334);
    expect(result["B"]).toBe(6667);
  });

  it("소주 총액 0원이면 소주 계산 생략", () => {
    const participants = [p("A", 5, 2), p("B", 0, 3)];
    const result = calculateSettlement(participants, 0, 20000);
    // 맥주만: A 2/5 * 20000 = 8000, B 3/5 * 20000 = 12000
    expect(result["A"]).toBe(8000);
    expect(result["B"]).toBe(12000);
  });

  it("전원 0잔이면 n/1 분배", () => {
    const participants = [p("A", 0, 0), p("B", 0, 0)];
    const result = calculateSettlement(participants, 20000, 0);
    expect(result["A"]).toBe(10000);
    expect(result["B"]).toBe(10000);
  });
});

describe("shouldTriggerNotification", () => {
  it("평균보다 3잔 이상 적으면 true", () => {
    // A: 1잔, B: 4잔, C: 4잔 → 평균 4잔, A는 3잔 이상 차이
    const participants = [p("A", 1, 0), p("B", 4, 0), p("C", 4, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(true);
  });

  it("2잔 차이면 false", () => {
    const participants = [p("A", 2, 0), p("B", 4, 0), p("C", 4, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(false);
  });

  it("정확히 3잔 차이면 true", () => {
    const participants = [p("A", 1, 0), p("B", 4, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(true);
  });

  it("깍두기·중도하차는 평균 계산에서 제외", () => {
    // A: 1잔, B(깍두기): 0잔, C: 2잔 → 활성 평균 = (1+2)/2 = 1.5, 차이 0.5 < 3
    const participants = [p("A", 1, 0), p("B", 0, 0, true), p("C", 2, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(false);
  });
});
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
cd app && npm test
```

Expected: FAIL (settlement 모듈 없음)

**Step 3: `app/src/lib/settlement.ts` 구현**

```ts
export interface Participant {
  id: string;
  name: string;
  soju: number;
  beer: number;
  isKkakdugi: boolean;
  status: "active" | "left";
  lastTapAt: Date | null;
}

/** 정산 대상: 깍두기 제외, 중도하차 포함 */
export function getSettlementParticipants(
  participants: Participant[],
): Participant[] {
  return participants.filter((p) => !p.isKkakdugi);
}

/** 노티/평균 계산 대상: 깍두기 + 중도하차 모두 제외 */
export function getActiveParticipants(
  participants: Participant[],
): Participant[] {
  return participants.filter((p) => !p.isKkakdugi && p.status === "active");
}

export function calculateSettlement(
  participants: Participant[],
  sojuTotal: number,
  beerTotal: number,
): Record<string, number> {
  const targets = getSettlementParticipants(participants);
  if (targets.length === 0) return {};

  const result: Record<string, number> = {};

  const totalSoju = targets.reduce((sum, p) => sum + p.soju, 0);
  const totalBeer = targets.reduce((sum, p) => sum + p.beer, 0);

  for (const p of targets) {
    let amount = 0;

    if (sojuTotal > 0) {
      if (totalSoju === 0) {
        // 전원 0잔: n/1 분배
        amount += Math.ceil(sojuTotal / targets.length);
      } else {
        amount += Math.ceil((p.soju / totalSoju) * sojuTotal);
      }
    }

    if (beerTotal > 0) {
      if (totalBeer === 0) {
        amount += Math.ceil(beerTotal / targets.length);
      } else {
        amount += Math.ceil((p.beer / totalBeer) * beerTotal);
      }
    }

    result[p.id] = amount;
  }

  return result;
}

/** 특정 참여자가 나머지 활성 참여자 평균보다 3잔 이상 적은지 확인 */
export function shouldTriggerNotification(
  participantId: string,
  participants: Participant[],
): boolean {
  const active = getActiveParticipants(participants);
  const target = active.find((p) => p.id === participantId);
  if (!target) return false;

  const others = active.filter((p) => p.id !== participantId);
  if (others.length === 0) return false;

  const othersAvg =
    others.reduce((sum, p) => sum + p.soju + p.beer, 0) / others.length;
  const targetTotal = target.soju + target.beer;

  return othersAvg - targetTotal >= 3;
}
```

**Step 4: 테스트 실행 (통과 확인)**

```bash
cd app && npm test
```

Expected: 모든 테스트 PASS

**Step 5: Commit**

```bash
git add app/src/lib/settlement.ts app/src/test/settlement.test.ts
git commit -m "feat: implement settlement logic with TDD (calculateSettlement, notifications)"
```

---

## Task 3: Firebase 초기화 및 Firestore 타입 정의

**Files:**

- Create: `app/src/lib/firebase.ts`
- Create: `app/src/lib/firestore.ts`
- Create: `app/.env.local` (gitignore에 포함)

**Step 1: Firebase 프로젝트 생성 (수동)**

Firebase 콘솔에서:

1. 새 프로젝트 생성
2. Firestore Database 생성 (프로덕션 모드)
3. 웹 앱 등록 → 설정값 복사

**Step 2: `app/.env.local` 작성**

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Step 3: `app/src/lib/firebase.ts` 작성**

```ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

**Step 4: `app/src/lib/firestore.ts` 작성 (CRUD + 타입)**

```ts
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
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Participant } from "./settlement";

export interface RoomDoc {
  hostId: string;
  status: "active" | "closed";
  createdAt: Timestamp;
  closedAt: Timestamp | null;
  deleteAt: Timestamp | null;
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

// 방 생성
export async function createRoom(hostId: string): Promise<string> {
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
  await updateDoc(doc(db, "rooms", roomId, "participants", participantId), {
    isKkakdugi,
  });
}

// 중도 하차
export async function leaveRoom(
  roomId: string,
  participantId: string,
): Promise<void> {
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
  await setDoc(doc(db, "rooms", roomId, "settlement", "result"), {
    sojuTotal,
    beerTotal,
    result,
  });
}

// 실시간 참여자 구독 (리더보드)
export function subscribeParticipants(
  roomId: string,
  callback: (participants: (ParticipantDoc & { id: string })[]) => void,
) {
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
  return onSnapshot(doc(db, "rooms", roomId), (snap) => {
    callback(snap.exists() ? (snap.data() as RoomDoc) : null);
  });
}

// 정산 결과 조회
export async function getSettlement(
  roomId: string,
): Promise<SettlementDoc | null> {
  const snap = await getDoc(doc(db, "rooms", roomId, "settlement", "result"));
  return snap.exists() ? (snap.data() as SettlementDoc) : null;
}
```

**Step 5: `.env.local`을 `.gitignore`에 추가 확인**

`app/.gitignore`에 `.env.local`이 포함되어 있는지 확인. Vite 기본 gitignore에 이미 포함되어 있음.

**Step 6: Commit**

```bash
git add app/src/lib/firebase.ts app/src/lib/firestore.ts
git commit -m "feat: add Firebase/Firestore setup and CRUD functions"
```

---

## Task 4: 라우터 + 앱 구조

**Files:**

- Modify: `app/src/App.tsx`
- Create: `app/src/hooks/useLocalStorage.ts`

**Step 1: react-router-dom 설치**

```bash
cd app && npm install react-router-dom
```

**Step 2: `app/src/hooks/useLocalStorage.ts` 작성**

참여자 ID를 로컬스토리지에 저장해 새로고침 시 유지.

```ts
import { useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.error("localStorage 저장 실패");
    }
  };

  return [storedValue, setValue] as const;
}
```

**Step 3: `app/src/App.tsx` 작성**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";
import JoinPage from "./pages/JoinPage";
import ResultPage from "./pages/ResultPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/room/:roomId/join" element={<JoinPage />} />
          <Route path="/room/:roomId/result" element={<ResultPage />} />
        </Routes>
        {/* 하단 광고 배너 자리 */}
        <div className="fixed bottom-0 left-0 right-0 h-14 bg-gray-900 flex items-center justify-center text-xs text-gray-500">
          광고 배너 영역
        </div>
      </div>
    </BrowserRouter>
  );
}
```

**Step 4: pages 디렉터리 생성 및 빈 컴포넌트 작성**

`app/src/pages/HomePage.tsx`:

```tsx
export default function HomePage() {
  return <div>홈</div>;
}
```

`app/src/pages/RoomPage.tsx`:

```tsx
export default function RoomPage() {
  return <div>방</div>;
}
```

`app/src/pages/JoinPage.tsx`:

```tsx
export default function JoinPage() {
  return <div>참여</div>;
}
```

`app/src/pages/ResultPage.tsx`:

```tsx
export default function ResultPage() {
  return <div>결과</div>;
}
```

**Step 5: 빌드 확인**

```bash
cd app && npm run build
```

Expected: 빌드 성공

**Step 6: Commit**

```bash
git add app/src/
git commit -m "feat: add routing structure with react-router-dom"
```

---

## Task 5: 홈 페이지 — 방 생성

**Files:**

- Modify: `app/src/pages/HomePage.tsx`

**Step 1: `app/src/pages/HomePage.tsx` 구현**

```tsx
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
```

**Step 2: 개발 서버에서 수동 확인**

```bash
cd app && npm run dev
```

- 홈 화면 렌더링 확인
- "술자리 시작" 버튼 클릭 → Firebase 연결 확인 필요 (env 설정 후)

**Step 3: Commit**

```bash
git add app/src/pages/HomePage.tsx
git commit -m "feat: implement HomePage with room creation"
```

---

## Task 6: 참여 페이지 — 이름 입력

**Files:**

- Modify: `app/src/pages/JoinPage.tsx`

**Step 1: `app/src/pages/JoinPage.tsx` 구현**

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinRoom } from "../lib/firestore";
import { useLocalStorage } from "../hooks/useLocalStorage";

export default function JoinPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setParticipantId] = useLocalStorage<string | null>(
    `participant-${roomId}`,
    null,
  );

  async function handleJoin() {
    if (!name.trim() || !roomId) return;
    setLoading(true);
    try {
      const participantId = await joinRoom(roomId, name.trim());
      setParticipantId(participantId);
      navigate(`/room/${roomId}`);
    } catch (e) {
      console.error(e);
      alert("참여에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-16 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">🍶 잔잔바라</h1>
        <p className="text-gray-400 text-sm">술자리에 참여합니다</p>
      </div>
      <div className="w-full max-w-xs space-y-4">
        <input
          type="text"
          placeholder="이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          maxLength={10}
          className="w-full py-4 px-4 bg-gray-800 rounded-xl text-white text-center text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          autoFocus
        />
        <button
          onClick={handleJoin}
          disabled={!name.trim() || loading}
          className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-2xl text-xl font-bold text-black transition-colors"
        >
          {loading ? "참여 중..." : "참여하기"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/pages/JoinPage.tsx
git commit -m "feat: implement JoinPage with name input"
```

---

## Task 7: 방 페이지 — 핵심 화면 (리더보드 + 음주 기록 + QR)

**Files:**

- Modify: `app/src/pages/RoomPage.tsx`
- Create: `app/src/components/Leaderboard.tsx`
- Create: `app/src/components/DrinkButtons.tsx`
- Create: `app/src/components/QRShareModal.tsx`
- Create: `app/src/hooks/useRoom.ts`

**Step 1: `app/src/hooks/useRoom.ts` 작성**

```ts
import { useEffect, useState } from "react";
import { subscribeRoom, subscribeParticipants } from "../lib/firestore";
import type { RoomDoc, ParticipantDoc } from "../lib/firestore";

export function useRoom(roomId: string) {
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [participants, setParticipants] = useState<
    (ParticipantDoc & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubRoom = subscribeRoom(roomId, (r) => {
      setRoom(r);
      setLoading(false);
    });
    const unsubParticipants = subscribeParticipants(roomId, setParticipants);
    return () => {
      unsubRoom();
      unsubParticipants();
    };
  }, [roomId]);

  return { room, participants, loading };
}
```

**Step 2: `app/src/components/Leaderboard.tsx` 작성**

```tsx
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
```

**Step 3: `app/src/components/DrinkButtons.tsx` 작성**

```tsx
import { useState } from "react";
import { updateDrinkCount } from "../lib/firestore";

interface Props {
  roomId: string;
  participantId: string;
  soju: number;
  beer: number;
  onLeave: () => void;
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
            {cooldown["soju"] ? "⏳" : "+1 마셨다!"}
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
            {cooldown["beer"] ? "⏳" : "+1 마셨다!"}
          </button>
        </div>
      </div>

      {/* 중도 하차 */}
      <button
        onClick={onLeave}
        className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm underline"
      >
        귀가할게요 (중도 하차)
      </button>
    </div>
  );
}
```

**Step 4: `app/src/components/QRShareModal.tsx` 작성**

```tsx
import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  onClose: () => void;
}

export default function QRShareModal({ url, onClose }: Props) {
  function copyLink() {
    navigator.clipboard.writeText(url);
    alert("링크가 복사되었습니다!");
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-bold text-lg mb-4">친구 초대하기</h2>
        <div className="bg-white p-4 rounded-xl flex justify-center mb-4">
          <QRCodeSVG value={url} size={180} />
        </div>
        <button
          onClick={copyLink}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-black mb-2"
        >
          링크 복사
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
```

**Step 5: `app/src/pages/RoomPage.tsx` 구현**

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { toggleKkakdugi, leaveRoom, closeRoom } from "../lib/firestore";
import Leaderboard from "../components/Leaderboard";
import DrinkButtons from "../components/DrinkButtons";
import QRShareModal from "../components/QRShareModal";

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
    navigate(`/room/${roomId}/result`);
  }

  async function handleToggleKkakdugi(id: string, current: boolean) {
    if (!roomId) return;
    await toggleKkakdugi(roomId, id, !current);
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
          📱 초대
        </button>
      </div>

      {/* 리더보드 */}
      <div className="w-full max-w-md mb-6">
        <h2 className="text-sm text-gray-400 mb-2">현재 기록</h2>
        <Leaderboard
          participants={participants}
          isHost={isHost}
          onToggleKkakdugi={handleToggleKkakdugi}
        />
      </div>

      {/* 내 음주 기록 버튼 (참여자만) */}
      {me && me.status === "active" && (
        <DrinkButtons
          roomId={roomId!}
          participantId={participantId!}
          soju={me.soju}
          beer={me.beer}
          onLeave={handleLeave}
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
          <button
            onClick={handleClose}
            className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold"
          >
            🏁 술자리 종료 & 정산
          </button>
        </div>
      )}

      {showQR && (
        <QRShareModal url={joinUrl} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
}
```

**Step 6: 빌드 확인**

```bash
cd app && npm run build
```

**Step 7: Commit**

```bash
git add app/src/
git commit -m "feat: implement RoomPage with leaderboard, drink buttons, QR share"
```

---

## Task 8: 정산 페이지 — 총액 입력 및 계산

**Files:**

- Create: `app/src/pages/SettlePage.tsx`
- Modify: `app/src/pages/RoomPage.tsx` (종료 후 settle 페이지로 이동)
- Modify: `app/src/App.tsx` (settle 라우트 추가)

**Step 1: `app/src/App.tsx`에 라우트 추가**

```tsx
import SettlePage from "./pages/SettlePage";
// Routes에 추가:
<Route path="/room/:roomId/settle" element={<SettlePage />} />;
```

**Step 2: `app/src/pages/RoomPage.tsx` handleClose 수정**

```tsx
async function handleClose() {
  if (!roomId) return;
  if (!confirm("술자리를 종료하고 정산하시겠어요?")) return;
  await closeRoom(roomId);
  navigate(`/room/${roomId}/settle`); // settle 페이지로 이동
}
```

**Step 3: `app/src/pages/SettlePage.tsx` 구현**

```tsx
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
```

**Step 4: Commit**

```bash
git add app/src/pages/SettlePage.tsx app/src/pages/RoomPage.tsx app/src/App.tsx
git commit -m "feat: implement SettlePage with amount input and settlement calculation"
```

---

## Task 9: 결과 페이지 — 영수증 + 공유

**Files:**

- Modify: `app/src/pages/ResultPage.tsx`

**Step 1: html2canvas 확인 (Task 1에서 설치됨)**

**Step 2: `app/src/pages/ResultPage.tsx` 구현**

```tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
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
    const canvas = await html2canvas(receiptRef.current, {
      backgroundColor: "#1f2937",
    });
    const link = document.createElement("a");
    link.download = "잔잔바라_정산.png";
    link.href = canvas.toDataURL();
    link.click();
  }

  function handleKakaoShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "잔잔바라 정산 결과", url });
    } else {
      navigator.clipboard.writeText(url);
      alert("링크가 복사되었습니다!");
    }
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
      <h1 className="text-2xl font-bold mb-1">🧾 정산 결과</h1>
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
          onClick={handleSaveImage}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium"
        >
          📸 이미지 저장
        </button>
        <button
          onClick={handleKakaoShare}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-black"
        >
          💬 공유하기
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/src/pages/ResultPage.tsx
git commit -m "feat: implement ResultPage with receipt view, image save, share"
```

---

## Task 10: P1-1 음주 독려 노티

**Files:**

- Create: `app/src/hooks/useNotification.ts`
- Modify: `app/src/pages/RoomPage.tsx`

**Step 1: `app/src/hooks/useNotification.ts` 작성**

```ts
import { useEffect, useRef } from "react";
import { shouldTriggerNotification } from "../lib/settlement";
import type { ParticipantDoc } from "../lib/firestore";
import type { Participant } from "../lib/settlement";

interface Notification {
  participantId: string;
  name: string;
  triggeredAt: number;
}

export function useNotification(
  participants: (ParticipantDoc & { id: string })[],
  currentParticipantId: string | null,
  onNotify: (name: string) => void,
) {
  const lastNotified = useRef<Record<string, number>>({});
  const COOLDOWN = 30 * 60 * 1000; // 30분

  useEffect(() => {
    if (participants.length < 2) return;

    const mapped: Participant[] = participants.map((p) => ({
      id: p.id,
      name: p.name,
      soju: p.soju,
      beer: p.beer,
      isKkakdugi: p.isKkakdugi,
      status: p.status,
      lastTapAt: null,
    }));

    for (const p of mapped) {
      if (p.isKkakdugi || p.status === "left") continue;
      if (p.id === currentParticipantId) continue; // 자신은 자신에게 노티 안 함

      const now = Date.now();
      const last = lastNotified.current[p.id] ?? 0;
      if (now - last < COOLDOWN) continue;

      if (shouldTriggerNotification(p.id, mapped)) {
        lastNotified.current[p.id] = now;
        onNotify(p.name);
      }
    }
  }, [participants]);
}
```

**Step 2: RoomPage에 노티 UI 추가**

`app/src/pages/RoomPage.tsx`에 추가:

```tsx
import { useCallback, useState } from "react";
import { useNotification } from "../hooks/useNotification";

// RoomPage 함수 내부에 추가:
const [notification, setNotification] = useState<string | null>(null);

const handleNotify = useCallback((name: string) => {
  setNotification(name);
  setTimeout(() => setNotification(null), 5000);
}, []);

useNotification(participants, participantId, handleNotify);

// JSX에 추가 (헤더 아래):
{
  notification && (
    <div className="w-full max-w-md mb-4 px-4 py-3 bg-yellow-500/20 border border-yellow-500/50 rounded-xl text-center text-sm">
      👀 <strong>{notification}</strong>님, 진짜 안마시고 있음?
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/src/hooks/useNotification.ts app/src/pages/RoomPage.tsx
git commit -m "feat: add drink nudge notification (P1-1)"
```

---

## Task 11: P1-4 건배 버튼 (총무 전용)

**Files:**

- Modify: `app/src/lib/firestore.ts`
- Modify: `app/src/pages/RoomPage.tsx`

**Step 1: `firestore.ts`에 건배 함수 추가**

```ts
export async function toastAll(
  roomId: string,
  type: "soju" | "beer",
  participants: (ParticipantDoc & { id: string })[],
): Promise<void> {
  const active = participants.filter(
    (p) => p.status === "active" && !p.isKkakdugi,
  );
  const updates = active.map((p) =>
    updateDoc(doc(db, "rooms", roomId, "participants", p.id), {
      [type]: (type === "soju" ? p.soju : p.beer) + 1,
    }),
  );
  await Promise.all(updates);
}
```

**Step 2: RoomPage에 건배 버튼 추가 (isHost 블록 내)**

```tsx
import { toastAll } from "../lib/firestore";

// 총무 전용 버튼 영역에 추가:
<div className="flex gap-2">
  <button
    onClick={() => toastAll(roomId!, "soju", participants)}
    className="flex-1 py-3 bg-blue-700 hover:bg-blue-600 rounded-xl text-sm font-medium"
  >
    🍶 건배
  </button>
  <button
    onClick={() => toastAll(roomId!, "beer", participants)}
    className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 rounded-xl text-sm font-medium"
  >
    🍺 건배
  </button>
</div>;
```

**Step 3: Commit**

```bash
git add app/src/lib/firestore.ts app/src/pages/RoomPage.tsx
git commit -m "feat: add toast-all (건배) button for host (P1-4)"
```

---

## Task 12: 최종 테스트 실행 및 빌드 검증

**Step 1: 전체 테스트 실행**

```bash
cd app && npm test
```

Expected: 모든 테스트 PASS

**Step 2: 프로덕션 빌드**

```bash
npm run build
```

Expected: dist/ 생성, 빌드 에러 없음

**Step 3: 빌드 결과 로컬 미리보기**

```bash
npm run preview
```

Expected: localhost:4173 에서 앱 정상 동작

**Step 4: 수동 시나리오 테스트 체크리스트**

- [ ] 홈에서 "술자리 시작" → 방 생성 → QR 표시
- [ ] QR 링크로 다른 탭 접속 → 이름 입력 → 참여 완료
- [ ] 소주/맥주 +1 클릭 → 리더보드 실시간 반영
- [ ] -1 클릭 → 0 이하로 내려가지 않음
- [ ] 10초 내 연속 클릭 → 버튼 비활성화 (쿨다운)
- [ ] 총무: 깍두기 지정 → 리더보드에 표시
- [ ] 참여자: 중도 하차 → "(귀가)" 표시
- [ ] 총무: 술자리 종료 → 금액 입력 → 정산 결과 화면
- [ ] 결과 화면: 이미지 저장 → PNG 다운로드
- [ ] 결과 화면: 공유하기 → 링크 공유

**Step 5: 최종 Commit**

```bash
git add -A
git commit -m "feat: complete suljarri MVP (잔잔바라) - all P0+P1 features"
```

---

## Firestore Security Rules (별도 설정)

Firebase 콘솔에서 적용:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;

      match /participants/{participantId} {
        allow read: if true;
        allow create: if true;
        allow update: if true;
      }

      match /settlement/result {
        allow read: if true;
        allow write: if true;
      }

      match /logs/{logId} {
        allow write: if true;
      }
    }
  }
}
```

> 주의: MVP용 최소 규칙. 프로덕션 전에 hostId 검증 등 보안 강화 필요.
