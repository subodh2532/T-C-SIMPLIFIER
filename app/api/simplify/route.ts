import { NextRequest, NextResponse } from "next/server";
import { simplifyWithOpenRouter } from "@/lib/openrouter";
import type { LanguageOption } from "@/lib/types";

const validLanguages: LanguageOption[] = ["English", "Hindi", "Marathi", "Hinglish"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      language?: LanguageOption;
    };

    const text = body.text?.trim();
    const language = body.language;

    if (!text) {
      return NextResponse.json({ error: "Terms text is required." }, { status: 400 });
    }

    if (!language || !validLanguages.includes(language)) {
      return NextResponse.json({ error: "A supported language is required." }, { status: 400 });
    }

    const result = await simplifyWithOpenRouter(text.slice(0, 18000), language);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while simplifying the terms.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
