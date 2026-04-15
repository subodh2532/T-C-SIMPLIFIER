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
