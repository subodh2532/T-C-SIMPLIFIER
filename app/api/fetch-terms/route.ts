import { NextRequest, NextResponse } from "next/server";
import { extractTermsContent } from "@/lib/extractTerms";

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const parsedUrl = normalizeUrl(rawUrl);

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not fetch the webpage. Please try a different URL." },
        { status: 400 }
      );
    }

    const html = await response.text();
    const content = extractTermsContent(html);

    if (!content || content.length < 300) {
      return NextResponse.json(
        { error: "Readable Terms & Conditions content was not found on that page." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      source: parsedUrl.hostname,
      content
    });
  } catch {
    return NextResponse.json(
      {
        error: "Invalid URL or extraction failed. Please check the link and try again."
      },
      { status: 400 }
    );
  }
}
