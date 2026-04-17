import type { AnalysisResult, RiskItem, Verdict } from "@/lib/types";

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
  summary?: string[];
  risks?: RiskItem[];
  verdict?: Verdict;
  verdict_reason?: string;
  extracted_preview?: string[];
};

function buildPrompt(text: string) {
  return `
You are a legal simplification assistant.

Read the Terms and Conditions text and return only valid JSON.

Goals:
1. Convert the document into short, simple bullet points for everyday users.
2. Highlight the biggest risks using severity levels High, Medium, or Low.
3. Give a final verdict: Safe, Caution, or Risky.
4. Keep explanations plain and practical, not academic.

Return this exact JSON shape:
{
  "summary": ["bullet", "bullet", "bullet"],
  "risks": [
    {
      "level": "High",
      "title": "Short risk title",
      "detail": "One clear sentence explaining the risk"
    }
  ],
  "verdict": "Caution",
  "verdict_reason": "One short sentence",
  "extracted_preview": ["short excerpt", "short excerpt", "short excerpt"]
}

Rules:
- Return 3 to 6 summary bullets.
- Return 2 to 5 risks when possible.
- If the text seems mostly harmless, use lower severity items honestly.
- extracted_preview must be short direct snippets or paraphrased excerpts from the supplied text.
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

function normalizeResult(parsed: ParsedAnalysis): AnalysisResult {
  const risks = Array.isArray(parsed.risks)
    ? parsed.risks
        .map((risk) => ({
          level:
            risk.level === "High" || risk.level === "Medium" || risk.level === "Low"
              ? risk.level
              : "Medium",
          title: String(risk.title || "Potential issue"),
          detail: String(risk.detail || "Review this clause carefully.")
        }))
        .slice(0, 5)
    : [];

  const verdict: Verdict =
    parsed.verdict === "Safe" || parsed.verdict === "Risky" || parsed.verdict === "Caution"
      ? parsed.verdict
      : risks.some((risk) => risk.level === "High")
        ? "Risky"
        : risks.some((risk) => risk.level === "Medium")
          ? "Caution"
          : "Safe";

  return {
    summary:
      Array.isArray(parsed.summary) && parsed.summary.length
        ? parsed.summary.map(String).slice(0, 6)
        : ["The document was analyzed, but a clear summary could not be structured."],
    risks:
      risks.length > 0
        ? risks
        : [
            {
              level: "Low",
              title: "No major issue detected",
              detail: "No clear high-risk clause stood out in the provided text."
            }
          ],
    verdict,
    verdict_reason: String(
      parsed.verdict_reason ||
        (verdict === "Risky"
          ? "This text contains strong caution signals."
          : verdict === "Caution"
            ? "Some clauses deserve careful review before you agree."
            : "No major red flags were obvious from the supplied text.")
    ),
    extracted_preview:
      Array.isArray(parsed.extracted_preview) && parsed.extracted_preview.length
        ? parsed.extracted_preview.map(String).slice(0, 4)
        : []
  };
}

export async function simplifyWithOpenRouter(
  text: string,
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
        "You simplify legal agreements into structured, everyday language and return strict JSON."
    },
    {
      role: "user",
      content: buildPrompt(text)
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
