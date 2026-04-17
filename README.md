# T&C Simplifier

A complete MVP web app built with Next.js App Router that helps users understand Terms & Conditions by:

- scanning documents with the camera
- uploading images for OCR
- pasting raw text
- pasting a website URL to detect legal pages
- simplifying the content with OpenRouter
- reading the result aloud with browser voice output

## Stack

- Next.js
- Tailwind CSS v4
- Tesseract.js
- Cheerio
- OpenRouter API
- No database

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
copy .env.example .env.local
```

3. Add your OpenRouter key in `.env.local`:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=mistralai/mistral-7b-instruct
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Features

- `getUserMedia` camera scanning flow
- image upload OCR with Tesseract.js
- URL analysis route that fetches HTML, detects likely legal links, and extracts readable text with Cheerio
- OpenRouter-powered simplification route
- summary, risks, verdict, and supporting excerpts
- browser speech synthesis for voice playback
- loading states, retry action, and API error handling

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the repository into Vercel as a Next.js project.
3. Add these environment variables in Vercel:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional)
- `APP_URL` (optional)

4. Redeploy after saving environment variables.

## Notes

- OCR quality depends on image clarity and contrast.
- Some websites block scraping or load legal pages dynamically, so URL extraction will work best on pages with accessible server-rendered HTML.
- Speech synthesis voices vary by browser and operating system.
