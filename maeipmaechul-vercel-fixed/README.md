# 매입매출 증빙관리 - Vercel 배포용

## Vercel 환경변수
Vercel Project Settings > Environment Variables에 아래 3개를 추가하세요.

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

선택사항:

- `GEMINI_MODEL` : 기본값은 `gemini-2.5-flash`

## GitHub 업로드 후 Vercel 설정

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## API 구조

기존 `server.ts`에 있던 서버 기능을 Vercel Serverless Function 방식으로 분리했습니다.

- `/api/config`
- `/api/chat`
- `/api/ocr/analyze`

`server.ts`는 기존 참고용으로 남겨두었지만 Vercel 배포에서는 사용하지 않습니다.
