import * as cheerio from "cheerio";

const KEYWORD_PATTERNS = [
  "terms",
  "conditions",
  "terms of service",
  "terms and conditions",
  "user agreement",
  "subscription",
  "privacy",
  "billing",
  "refund",
  "renewal"
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function scoreTextBlock(text: string) {
  const normalized = text.toLowerCase();
  const keywordScore = KEYWORD_PATTERNS.reduce(
    (score, keyword) => score + (normalized.includes(keyword) ? 14 : 0),
    0
  );

  const lengthScore = Math.min(text.length / 110, 30);
  const sentenceScore = Math.min((text.match(/[.!?]/g) ?? []).length * 1.5, 24);

  return keywordScore + lengthScore + sentenceScore;
}

export function extractTermsContent(html: string) {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, nav, footer, header, iframe, form").remove();

  const candidates: { text: string; score: number }[] = [];

  const selectors = [
    "main",
    "article",
    "[role='main']",
    "section",
    "div",
    "body"
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = normalizeWhitespace($(element).text());
      if (text.length < 450) {
        return;
      }

      const score = scoreTextBlock(text);
      if (score > 24) {
        candidates.push({ text, score });
      }
    });
  }

  const bestCandidate = candidates.sort((a, b) => b.score - a.score)[0];

  if (!bestCandidate) {
    const fallback = normalizeWhitespace($("body").text());
    return fallback.slice(0, 14000);
  }

  return bestCandidate.text.slice(0, 14000);
}
