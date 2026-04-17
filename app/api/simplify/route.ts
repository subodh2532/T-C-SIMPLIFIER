import { NextRequest, NextResponse } from "next/server";
import { simplifyWithOpenRouter } from "@/lib/openrouter";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
    };

    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Terms text is required." }, { status: 400 });
    }

    const requestOrigin = request.headers.get("origin");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("host");
    const origin =
      requestOrigin ||
      (forwardedHost ? `${forwardedProto || "https"}://${forwardedHost}` : undefined);

    const result = await simplifyWithOpenRouter(text.slice(0, 18000), origin);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while simplifying the terms.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
