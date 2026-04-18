import { NextRequest, NextResponse } from "next/server";
import { simplifyWithOpenRouter } from "@/lib/openrouter";
import type { OutputLanguage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      language?: OutputLanguage;
    };

    const text = body.text?.trim();
    const language = body.language ?? "English";

    if (!text) {
      return NextResponse.json({ error: "Terms text is required." }, { status: 400 });
    }

    const requestOrigin = request.headers.get("origin");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("host");
    const origin =
      requestOrigin ||
      (forwardedHost ? `${forwardedProto || "https"}://${forwardedHost}` : undefined);

    const result = await simplifyWithOpenRouter(text.slice(0, 18000), language, origin);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while simplifying the terms.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
