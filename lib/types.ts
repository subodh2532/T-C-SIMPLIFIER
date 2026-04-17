export type InputMode = "camera" | "upload" | "text" | "url";

export type RiskLevel = "High" | "Medium" | "Low";

export type Verdict = "Safe" | "Caution" | "Risky";

export type RiskItem = {
  level: RiskLevel;
  title: string;
  detail: string;
};

export type AnalysisResult = {
  summary: string[];
  risks: RiskItem[];
  verdict: Verdict;
  verdict_reason: string;
  extracted_preview: string[];
};

export type FetchTermsResponse = {
  content: string;
  source: string;
  pageTitle?: string;
  matchedPath?: string;
};
