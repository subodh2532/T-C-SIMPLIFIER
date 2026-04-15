import type { LanguageOption, SimplifiedTerms } from "@/lib/types";

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

function buildPrompt(text: string, language: LanguageOption) {
  return `
You are a helpful Terms and Conditions simplifier for students and everyday users.

Task:
- Read the legal text carefully.
- Explain it in ${language}.
- Use simple conversational wording.
- Avoid legal jargon and avoid scary wording unless a real risk exists.
- Highlight risky clauses such as data sharing, auto-renewal, no refunds, hidden charges, one-sided liability, arbitration, account termination, and broad permissions.
- Explain what data is collected, how it is used, and whether it may be shared.
- Rate the safety on a 1 to 10 scale.

Language rules:
- English: plain everyday English
- Hindi: simple spoken Hindi
- Marathi: easy conversational Marathi
- Hinglish: natural Hindi-English mix

Return only valid JSON with this exact shape:
{
  "language": "${language}",
  "summary": ["3 to 5 bullets"],
  "key_points": ["important points"],
  "risks": ["risk alerts"],
  "data_usage": ["data collection and sharing points"],
  "safety_score": 1
}

Extra rules:
- Every array must contain at least 3 short bullet strings when the text contains enough information.
- Keep bullets concise.
- safety_score must be an integer from 1 to 10.
- Do not wrap the JSON in markdown.

Legal text:
"""${text}"""
`.trim();
}

function parseJsonFromModel(content: string): SimplifiedTerms {
  const cleaned = content.trim();
  const jsonBlockMatch = cleaned.match(/\{[\s\S]*\}/);
  const rawJson = jsonBlockMatch ? jsonBlockMatch[0] : cleaned;
  const parsed = JSON.parse(rawJson) as SimplifiedTerms;

  return {
    language: parsed.language,
    summary: parsed.summary ?? [],
    key_points: parsed.key_points ?? [],
    risks: parsed.risks ?? [],
    data_usage: parsed.data_usage ?? [],
    safety_score: Number(parsed.safety_score)
  };
}

export async function simplifyWithOpenRouter(
  text: string,
  language: LanguageOption,
  referer?: string
): Promise<SimplifiedTerms> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to your environment variables.");
  }

  const model = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct";

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You simplify Terms and Conditions into safe, student-friendly explanations and return strict JSON."
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

  const result = parseJsonFromModel(content);
  const safetyScore = Math.min(10, Math.max(1, Math.round(result.safety_score || 1)));

  return {
    language,
    summary: result.summary.slice(0, 5),
    key_points: result.key_points.slice(0, 6),
    risks: result.risks.slice(0, 6),
    data_usage: result.data_usage.slice(0, 6),
    safety_score: safetyScore
  };
}
