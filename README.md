# T&C Simplifier

A Next.js App Router project that works well on Vercel and helps users:

- paste ecommerce product links
- auto-fill readable product or policy content
- upload gallery images for OCR
- scan documents with the camera
- paste raw text
- generate bullet points for terms and conditions, advantages, disadvantages, and precautions
- listen to the result with multilingual browser voice output

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
- gallery image upload with OCR via Tesseract.js
- ecommerce product URL autofill from product description and related page content
- legal/policy page fallback extraction with Cheerio
- OpenRouter-powered structured analysis
- output sections for terms and conditions, advantages, disadvantages, and precautions
- multilingual voice playback
- loading states, retry action, and API error handling

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the repository into Vercel as a Next.js project.
3. In Vercel Project Settings -> Environment Variables, add:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional, for example `mistralai/mistral-7b-instruct`)
- `APP_URL` (recommended: your deployed production URL)

4. Add the variables to `Production` and `Preview` if you want both environments to work.
5. Redeploy after saving environment variables.

## Vercel Notes

- API routes are pinned to the Node.js runtime for compatibility with `cheerio` and the OpenRouter server call.
- Route handlers are marked dynamic so product-link and policy fetching is always done at request time.
- OCR runs in the browser, so no extra server setup is needed for image processing on Vercel.
- If product-link analysis works locally but fails on deployment, the site you are fetching may be blocking bot traffic or serving different HTML to Vercel.

## Notes

- OCR quality depends on image clarity and contrast.
- Some ecommerce sites block scraping or load product/legal pages dynamically, so URL extraction works best on pages with accessible server-rendered HTML.
- Speech synthesis voices vary by browser and operating system.
