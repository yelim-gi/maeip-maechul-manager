# 매입매출 증빙관리 시스템

ZIP을 풀면 최상단에 바로 아래 파일들이 있어야 합니다.

- `api`
- `src`
- `package.json`
- `vite.config.js`
- `index.html`

## Vercel 환경변수

```env
GEMINI_API_KEY=발급받은키
GEMINI_MODEL=gemini-2.5-flash
```

## Vercel 설정

- Framework Preset: Vite
- Build Command: npx vite build
- Output Directory: dist
- Install Command: npm install
- Root Directory: `./`

## GitHub 업로드

```bash
git init
git add .
git commit -m "first commit"
git remote add origin 깃허브주소
git branch -M main
git push -u origin main
```
