# Let's Workout — Frontend

웨이트 트레이닝 기록 앱의 모바일 클라이언트입니다. 운동 세션을 시작해 종목별 세트(무게 × 횟수)를 기록하고, 사진·영상을 첨부하고, 날짜별 기록과 부위별 볼륨 추이를 확인합니다.

- **스택**: Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · Expo Router · Reanimated 4
- **플랫폼**: iOS · Android (웹은 개발 확인용)
- **백엔드**: [`../backend`](../backend) (Spring Boot REST API, 기본 주소 `https://workout-api.jjoon.cloud`)

## 아키텍처

```
앱 (Expo / React Native)
 ├─ src/app/         화면 (Expo Router 파일 기반 라우팅)
 ├─ src/components/  공용 UI
 ├─ src/hooks/       상태·데이터 훅
 └─ src/api/         REST 호출 (client.ts: fetch 래퍼, 토큰, 에러 처리)
        │  HTTPS + Bearer 토큰
        ▼
Backend API ── PostgreSQL (운동 데이터)
            └─ S3 호환 스토리지 (사진·영상)
```

```
src/
├── app/
│   ├── _layout.tsx        # 루트 Stack: 폰트, 스플래시, 테마
│   ├── index.tsx          # 로그인 (초기 화면)
│   ├── exercise-form.tsx  # 종목 추가/수정
│   └── (tabs)/            # 하단 탭: home / history / stats
│       ├── group/[id].tsx   # 부위별 종목 목록
│       ├── record/[id].tsx  # 세트 기록
│       └── exercises.tsx    # 종목 관리
├── api/                   # auth, workout, stats API
├── components/            # 재사용 UI
├── hooks/                 # 커스텀 훅
├── lib/                   # 다이얼로그 등 유틸
├── data/                  # 포맷터, 부위 카탈로그
└── constants/theme.ts     # 팔레트, 폰트
scripts/dev-proxy.mjs      # 웹 개발용 CORS 프록시
```

- **인증**: 로그인 토큰은 `expo-secure-store`에 저장합니다. 서버가 세션 만료(`401`)를 알리면 토큰을 지우고 로그인 화면으로 돌아갑니다.
- **데이터**: 로컬 DB 없이 서버 데이터를 그대로 사용합니다. 오류는 모두 `ApiError`로 통일됩니다.
- **네이티브 폴더**: `ios/`, `android/`는 자동 생성(CNG)되며 git에 포함하지 않습니다. 네이티브 설정은 `app.json`과 config plugin으로만 바꿉니다.

## 실행 방법

필요한 것: Node.js LTS. 네이티브 빌드를 하려면 Xcode(iOS) 또는 Android Studio(Android)도 필요합니다.

```bash
npm install
```

기본으로 운영 API에 연결됩니다. 로컬 백엔드를 쓰려면 `.env`를 만드세요. 실기기에서 접속할 때는 `localhost` 대신 Mac의 LAN IP를 넣어야 합니다.

```bash
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://192.168.0.10:8080
```

```bash
npm start          # 개발 서버 (Expo Go 또는 개발 빌드로 접속)
npm run ios        # iOS 시뮬레이터용 빌드 + 실행 (expo run:ios)
npm run android    # Android 에뮬레이터용 빌드 + 실행 (expo run:android)
```

**웹 (개발용)**: API 서버가 CORS를 막아 두었기 때문에 로컬 프록시를 거쳐야 합니다. 터미널 두 개에서 실행하세요.

```bash
npm run proxy      # http://localhost:8787 → API 서버
npm run web:proxy  # 프록시를 바라보는 웹 개발 서버
```

**검사**

```bash
npm run lint       # ESLint
npx tsc --noEmit   # 타입 체크
```

## 앱 빌드

### 로컬 릴리스 빌드

기기에서 테스트할 용도입니다. 스토어 배포용 서명은 되지 않습니다.

```bash
npx expo run:ios --configuration Release
npx expo run:android --variant release
```

### EAS Build (스토어 배포용)

서명까지 된 빌드를 클라우드에서 만듭니다. 처음 한 번은 로그인과 설정이 필요하고, 설정하면 `eas.json`이 생성됩니다.

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure

npx eas-cli@latest build --platform ios       # 또는 android, all
npx eas-cli@latest submit --platform ios      # 스토어 제출
```

스토어 빌드에는 Apple Developer Program 또는 Google Play Developer 계정이 필요합니다. 서명 인증서와 키스토어는 EAS가 만들어 관리할 수 있습니다.
