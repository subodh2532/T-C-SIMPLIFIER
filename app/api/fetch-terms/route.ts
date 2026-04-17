import { NextRequest, NextResponse } from "next/server";
import { detectTermsLink, extractReadableText } from "@/lib/extractTerms";

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

async function fetchHtml(url: string) {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
    },
    cache: "no-store"
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
        { error: "Could not fetch the webpage. Please try a different URL." },
        { status: 400 }
      );
    }

    const initialHtml = await initialResponse.text();
    const matchedLink = detectTermsLink(initialHtml, baseUrl);

    const targetUrl = matchedLink || baseUrl.toString();
    const targetResponse =
      targetUrl === baseUrl.toString() ? initialResponse : await fetchHtml(targetUrl);

    const targetHtml =
      targetUrl === baseUrl.toString() ? initialHtml : await targetResponse.text();

    if (!targetResponse.ok) {
      return NextResponse.json(
        { error: "A terms or privacy page was found, but it could not be fetched." },
        { status: 400 }
      );
    }

    const content = extractReadableText(targetHtml);
    if (!content || content.length < 250) {
      return NextResponse.json(
        { error: "Readable legal content was not found on that page." },
        { status: 422 }
      );
    }

    const parsedTarget = new URL(targetUrl);

    return NextResponse.json({
      source: parsedTarget.hostname,
      pageTitle: parsedTarget.hostname,
      matchedPath: parsedTarget.pathname,
      content: content.slice(0, 14000)
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid URL or extraction failed. Please check the link and try again." },
      { status: 400 }
    );
  }
}
