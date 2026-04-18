import { NextRequest, NextResponse } from "next/server";
import {
  buildCandidateUrls,
  detectTermsLink,
  extractProductContent,
  extractReadableText,
  hasEnoughGeneralContent,
  hasEnoughLegalSignals,
  looksLikeProductUrl
} from "@/lib/extractTerms";

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

async function fetchHtml(url: string) {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept: "text/html,application/xhtml+xml"
    },
    cache: "no-store",
    redirect: "follow"
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const baseUrl = normalizeUrl(rawUrl);
    const initialResponse = await fetchHtml(baseUrl.toString());

    if (!initialResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Could not fetch that page. Try a direct privacy policy, terms page, or return policy link."
        },
        { status: 400 }
      );
    }

    const initialHtml = await initialResponse.text();
    const isProductPage = looksLikeProductUrl(baseUrl);

    if (isProductPage) {
      const productContent = extractProductContent(initialHtml);

      if (hasEnoughGeneralContent(productContent)) {
        return NextResponse.json({
          source: baseUrl.hostname,
          pageTitle: baseUrl.hostname,
          matchedPath: `${baseUrl.pathname}${baseUrl.search}`,
          content: productContent.slice(0, 14000)
        });
      }
    }

    const detectedLink = detectTermsLink(initialHtml, baseUrl);
    const candidateUrls = buildCandidateUrls(baseUrl, detectedLink);

    for (const candidateUrl of candidateUrls) {
      try {
        const response =
          candidateUrl === baseUrl.toString()
            ? initialResponse
            : await fetchHtml(candidateUrl);

        if (!response.ok) {
          continue;
        }

        const html = candidateUrl === baseUrl.toString() ? initialHtml : await response.text();
        const parsedTarget = new URL(candidateUrl);
        const content = looksLikeProductUrl(parsedTarget)
          ? extractProductContent(html)
          : extractReadableText(html);

        if (!hasEnoughLegalSignals(content) && !hasEnoughGeneralContent(content)) {
          continue;
        }

        return NextResponse.json({
          source: parsedTarget.hostname,
          pageTitle: parsedTarget.hostname,
          matchedPath: parsedTarget.pathname + parsedTarget.search,
          content: content.slice(0, 14000)
        });
      } catch {
        continue;
      }
    }

    return NextResponse.json(
      {
        error:
          "This link did not expose enough readable product or policy content. Try another product page, a direct terms page, or a clearer screenshot."
      },
      { status: 422 }
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid URL or extraction failed. Please paste a full website link and try again."
      },
      { status: 400 }
    );
  }
}
