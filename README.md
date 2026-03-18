# 술자리 계산기 (Suljarri Calculator)

술자리에서 각자 마신 양에 비례하여 비용을 정산하는 실시간 웹 앱입니다.

## 주요 기능

- **방 생성 & QR 초대** - 방을 만들고 QR 코드 또는 링크로 친구를 초대
- **실시간 음주 트래킹** - 소주/맥주 잔 수를 실시간으로 기록 (Firebase Firestore 동기화)
- **리더보드** - 참가자별 음주량 순위 실시간 표시
- **깍두기 지정** - 호스트가 비용 미참여자(깍두기)를 토글
- **건배 기능** - 전체 참가자 음주 수 일괄 +1
- **비례 정산** - 마신 양에 비례한 비용 자동 분배 알고리즘
- **음주 알림** - 평균 대비 3잔 이상 적게 마신 참가자 감지
- **영수증 스타일 결과** - 정산 결과를 이미지로 저장하거나 공유

## 사용자 흐름

```
홈페이지 → 방 생성 → 참가자 초대(QR/링크)
                         ↓
                    음주 트래킹 (실시간)
                         ↓
                    방 종료 → 비용 입력 → 정산 결과
```

## 기술 스택

| 카테고리 | 기술 |
|---------|------|
| Frontend | React 19, TypeScript |
| 스타일링 | Tailwind CSS 4 |
| 빌드 | Vite 8 |
| 백엔드 | Firebase Firestore (실시간 동기화) |
| 테스트 | Vitest, Testing Library |
| 기타 | html2canvas (이미지 저장), qrcode.react (QR 생성) |

## 프로젝트 구조

```
src/
├── App.tsx                    # 라우팅 설정 (5개 페이지)
├── main.tsx                   # 앱 엔트리포인트
├── components/
│   ├── DrinkButtons.tsx       # 소주/맥주 +/- 버튼 (10초 쿨다운)
│   ├── Leaderboard.tsx        # 음주량 순위 + 깍두기 토글
│   └── QRShareModal.tsx       # QR 코드 초대 모달
├── hooks/
│   ├── useRoom.ts             # Firestore 실시간 구독 (방 + 참가자)
│   ├── useLocalStorage.ts     # localStorage 상태 동기화
│   └── useNotification.ts     # 음주량 부족 알림 (30분 쿨다운)
├── lib/
│   ├── firebase.ts            # Firebase 초기화
│   ├── firestore.ts           # Firestore CRUD & 실시간 구독 (10개 함수)
│   └── settlement.ts          # 비례 정산 알고리즘 (순수 비즈니스 로직)
├── pages/
│   ├── HomePage.tsx           # 방 생성 랜딩 페이지
│   ├── JoinPage.tsx           # 초대 링크로 참가
│   ├── RoomPage.tsx           # 메인 음주 세션 (가장 복잡한 페이지)
│   ├── SettlePage.tsx         # 총 비용 입력 → 정산 계산
│   └── ResultPage.tsx         # 영수증 스타일 결과 표시
└── test/
    ├── setup.ts               # 테스트 환경 설정
    └── settlement.test.ts     # 정산 알고리즘 단위 테스트
```

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 테스트 실행
npm test

# 프로덕션 빌드
npm run build
```

## 환경 변수

Firebase 설정을 위한 환경 변수가 필요합니다. `.env` 파일을 생성하고 Firebase 프로젝트 설정값을 입력하세요.

## 아키텍처

```
Pages & Routing  ──→  UI Components
      │                     │
      ├─────────→  Hooks ───┘
      │              │
      └─────────→  Service & Data (Firebase + Settlement)
```

- **Pages**: 사용자 흐름을 관리하는 5개 페이지 컴포넌트
- **UI Components**: 재사용 가능한 프레젠테이션 컴포넌트 3개
- **Hooks**: Firestore 구독과 UI 사이를 연결하는 커스텀 훅
- **Service & Data**: Firebase 초기화, Firestore CRUD, 정산 로직 (가장 높은 fan-in - `firestore.ts`를 10곳에서 import)
