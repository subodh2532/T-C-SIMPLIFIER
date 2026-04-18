import type { AnalysisResult, OutputLanguage, Verdict } from "@/lib/types";

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterChoice = {
  message?: {
    content?: string;
  };
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
};

type ParsedAnalysis = {
  terms_and_conditions?: string[];
  advantages?: string[];
  disadvantages?: string[];
  precautions?: string[];
  verdict?: Verdict;
  verdict_reason?: string;
  extracted_preview?: string[];
};

function buildPrompt(text: string, language: OutputLanguage) {
  return `
You are a shopping and terms simplification assistant.

The user may provide:
- an ecommerce product page
- product information
- return or warranty text
- a screenshot from a shopping app
- terms and conditions text

Explain the content in ${language}.

Return only valid JSON in this exact shape:
{
  "terms_and_conditions": ["bullet", "bullet", "bullet"],
  "advantages": ["bullet", "bullet", "bullet"],
  "disadvantages": ["bullet", "bullet", "bullet"],
  "precautions": ["bullet", "bullet", "bullet"],
  "verdict": "Caution",
  "verdict_reason": "One short sentence",
  "extracted_preview": ["short excerpt", "short excerpt", "short excerpt"]
}

Rules:
- Keep every bullet short and easy to understand.
- Use everyday wording, not legal or technical jargon.
- If the input is a product page, include likely buyer advantages, disadvantages, and precautions.
- If the input is legal text, explain the practical meaning for a buyer.
- Return 3 to 5 bullets for each array when possible.
- precautions should focus on what the user should check before buying or agreeing.
- extracted_preview should contain short source snippets or paraphrased snippets from the text.
- Do not wrap the JSON in markdown.

Text:
"""${text}"""
`.trim();
}

function parseJson(content: string): ParsedAnalysis {
  const cleaned = content.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const raw = jsonMatch ? jsonMatch[0] : cleaned;

  return JSON.parse(raw) as ParsedAnalysis;
}

function normalizeList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  return value.map(String).slice(0, 5);
}

function normalizeResult(parsed: ParsedAnalysis): AnalysisResult {
  const disadvantages = normalizeList(parsed.disadvantages, [
    "No clear disadvantages were detected from the provided content."
  ]);
  const precautions = normalizeList(parsed.precautions, [
    "Read the return, refund, and warranty details before you proceed."
  ]);

  const verdict: Verdict =
    parsed.verdict === "Safe" || parsed.verdict === "Risky" || parsed.verdict === "Caution"
      ? parsed.verdict
      : disadvantages.some((item) =>
            item.toLowerCase().match(/hidden|strict|limited|non-refundable|risk|extra charge/)
          )
        ? "Caution"
        : "Safe";

  return {
    terms_and_conditions: normalizeList(parsed.terms_and_conditions, [
      "The main conditions could not be structured clearly from the provided content."
    ]),
    advantages: normalizeList(parsed.advantages, [
      "The content does not clearly list strong benefits, so review the product details carefully."
    ]),
    disadvantages,
    precautions,
    verdict,
    verdict_reason: String(
      parsed.verdict_reason ||
        (verdict === "Risky"
          ? "There are strong warning signs in this content."
          : verdict === "Caution"
            ? "Check the important details before you buy or accept."
            : "Nothing strongly risky stood out from the provided content.")
    ),
    extracted_preview: normalizeList(parsed.extracted_preview, [])
  };
}

export async function simplifyWithOpenRouter(
  text: string,
  language: OutputLanguage,
  referer?: string
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to your environment variables.");
  }

  const model = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct";

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You convert shopping pages, screenshots, and terms text into short consumer-friendly JSON."
    },
    {
      role: "user",
      content: buildPrompt(text, language)
    }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        referer ||
        process.env.APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000"),
      "X-Title": "T&C Simplifier"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${errorText}`);
  }

  const payload = (await response.json()) as OpenRouterResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return normalizeResult(parseJson(content));
}
