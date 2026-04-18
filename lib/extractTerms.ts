import * as cheerio from "cheerio";

const LINK_PATTERNS = [
  "terms",
  "conditions",
  "terms-of-service",
  "terms-and-conditions",
  "user-agreement",
  "legal",
  "privacy",
  "policy",
  "return-policy",
  "returns",
  "refund"
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
  "arbitration",
  "return policy",
  "cancellation"
];

const GENERIC_LEGAL_PATHS = [
  "/terms",
  "/terms-and-conditions",
  "/terms-of-use",
  "/terms-of-service",
  "/legal",
  "/privacy",
  "/privacy-policy",
  "/return-policy",
  "/returns",
  "/refund-policy"
];

const DOMAIN_HINTS: Record<string, string[]> = {
  "amazon.in": ["/gp/help/customer/display.html?nodeId=201909000", "/privacy"],
  "amazon.com": ["/gp/help/customer/display.html?nodeId=508088", "/privacy"],
  "flipkart.com": ["/pages/privacypolicy", "/pages/terms", "/pages/returnpolicy"],
  "myntra.com": ["/privacy-policy", "/terms-of-use"],
  "ajio.com": ["/privacy-policy", "/terms-and-conditions"]
};

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

export function hasEnoughLegalSignals(text: string) {
  if (text.length < 250) {
    return false;
  }

  const normalized = text.toLowerCase();
  const hits = TEXT_PATTERNS.reduce(
    (count, keyword) => count + (normalized.includes(keyword) ? 1 : 0),
    0
  );

  return hits >= 2;
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

export function buildCandidateUrls(baseUrl: URL, detectedLink?: string) {
  const seen = new Set<string>();
  const candidates: string[] = [];

  function add(url: string) {
    if (!seen.has(url)) {
      seen.add(url);
      candidates.push(url);
    }
  }

  add(baseUrl.toString());

  if (detectedLink) {
    add(detectedLink);
  }

  for (const path of GENERIC_LEGAL_PATHS) {
    add(new URL(path, baseUrl).toString());
  }

  const hostname = baseUrl.hostname.replace(/^www\./, "");
  const hinted = DOMAIN_HINTS[hostname] ?? [];

  for (const path of hinted) {
    add(new URL(path, baseUrl).toString());
  }

  return candidates;
}
