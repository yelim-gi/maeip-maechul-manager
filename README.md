# 매입매출·증빙관리 웹사이트

개인사업자용 매입/매출/증빙/거래내역 관리 MVP입니다.

## 포함 기능

- 월별 대시보드
- 거래내역 수동 입력
- CSV/XLSX 업로드
- 거래명세서/PDF/이미지 업로드
- Gemini API 문서 분석 연결
- 거래내역 vs 증빙 금액 비교
- 증빙 없음/차액 발생 표시
- 카테고리 관리
- 엑셀 다운로드
- Supabase 연결 준비
- Vercel 배포 준비

## 실행 방법

```bash
npm install
npm run dev
```

## 환경변수

`.env.example` 파일을 복사해서 `.env`로 만들고 값을 넣어주세요.

```env
VITE_SUPABASE_URL=Supabase Project URL
VITE_SUPABASE_ANON_KEY=Supabase anon public key
GEMINI_API_KEY=Google AI Studio Gemini API Key
```

## Supabase DB 만들기

Supabase SQL Editor에서 `supabase_schema.sql` 내용을 실행하세요.

## Vercel 배포

1. GitHub에 이 프로젝트 업로드
2. Vercel에서 Import Project
3. Environment Variables에 아래 3개 추가
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - GEMINI_API_KEY
4. Deploy

## 주의

- Gemini 결과는 자동 저장되지 않고, 검토 후 저장하는 구조입니다.
- 세금 계산은 참고용입니다.
- 실제 신고 전에는 세무사/국세청 기준 확인이 필요합니다.
