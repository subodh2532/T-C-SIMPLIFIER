import type { Verdict, RiskLevel } from "@/lib/types";

export function getRiskTone(level: RiskLevel) {
  if (level === "High") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (level === "Medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function getVerdictTone(verdict: Verdict) {
  if (verdict === "Risky") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  if (verdict === "Caution") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}
