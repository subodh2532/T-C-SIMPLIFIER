import * as cheerio from "cheerio";

const LINK_PATTERNS = [
  "terms",
  "conditions",
  "terms-of-service",
  "terms-and-conditions",
  "user-agreement",
  "legal",
  "privacy",
  "policy"
];

const TEXT_PATTERNS = [
  "terms",
  "conditions",
  "subscription",
  "renewal",
  "refund",
  "payment",
  "privacy",
  "data",
  "liability",
  "terminate",
  "arbitration"
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function scoreCandidateText(text: string) {
  const normalized = text.toLowerCase();
  const keywordBoost = TEXT_PATTERNS.reduce(
    (total, keyword) => total + (normalized.includes(keyword) ? 16 : 0),
    0
  );
  const sentenceBoost = Math.min((text.match(/[.!?]/g) ?? []).length * 1.2, 36);
  const lengthBoost = Math.min(text.length / 100, 40);

  return keywordBoost + sentenceBoost + lengthBoost;
}

export function extractReadableText(html: string) {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, nav, footer, header, iframe, form").remove();

  const candidates: { text: string; score: number }[] = [];

  const selectors = ["main", "article", "[role='main']", "section", "div", "body"];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = normalizeWhitespace($(element).text());

      if (text.length < 400) {
        return;
      }

      const score = scoreCandidateText(text);
      if (score > 36) {
        candidates.push({ text, score });
      }
    });
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  const fallback = normalizeWhitespace($("body").text());

  return (best?.text || fallback).slice(0, 16000);
}

export function detectTermsLink(html: string, baseUrl: URL) {
  const $ = cheerio.load(html);
  const candidates: { href: string; score: number }[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const text = normalizeWhitespace($(element).text()).toLowerCase();
    const rawHref = (href || "").toLowerCase();

    if (!href) {
      return;
    }

    const score = LINK_PATTERNS.reduce((total, keyword) => {
      const hit = text.includes(keyword) || rawHref.includes(keyword);
      return total + (hit ? 10 : 0);
    }, 0);

    if (score === 0) {
      return;
    }

    try {
      const absolute = new URL(href, baseUrl).toString();
      candidates.push({ href: absolute, score });
    } catch {
      return;
    }
  });

  return candidates.sort((a, b) => b.score - a.score)[0]?.href;
}
