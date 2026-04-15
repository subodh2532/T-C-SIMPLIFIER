# T&C Simplifier

A Next.js MVP that simplifies Terms & Conditions from pasted text, URLs, or scanned images. It supports OCR with Tesseract.js, multilingual AI output through OpenRouter, and browser voice playback.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env.local
```

3. Add your `OPENROUTER_API_KEY` in `.env.local`.

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Deploy To Vercel

1. Push this repo to GitHub and import it into Vercel as a Next.js project.
2. In Vercel Project Settings -> Environment Variables, add:
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL` (optional, defaults to `mistralai/mistral-7b-instruct`)
   - `APP_URL` (optional if you want to force a custom domain for OpenRouter referer headers)
3. Add the variables to `Production` and `Preview` if you want both deployed environments to work.
4. Redeploy after changing environment variables.

This app is customized to work well on Vercel:

- Next.js App Router is deployed with Vercel's default zero-config flow
- The OpenRouter referer is inferred from the live request origin when possible
- If no request origin is available, it falls back to `APP_URL`, then Vercel system URLs, then localhost

Useful Vercel docs:

- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Environment variables](https://vercel.com/docs/environment-variables)
- [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)

## Features

- Paste Terms & Conditions text into the textarea
- Fetch likely terms text from a website URL
- Scan a document with the camera or upload an image for OCR
- Generate simple bullets in English, Hindi, Marathi, or Hinglish
- Review a safety score, risk alerts, and data usage explanation
- Listen to the summary with browser text-to-speech

## Notes

- URL extraction works best on pages that already contain readable terms text in the HTML.
- OCR quality depends on image clarity and lighting.
- Voice output uses the browser Web Speech API, so available voices vary by device and browser.
