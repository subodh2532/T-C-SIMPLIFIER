export function getScoreLabel(score: number) {
  if (score >= 8) {
    return { text: "Safe", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  }

  if (score >= 5) {
    return { text: "Moderate", tone: "text-amber-700 bg-amber-50 border-amber-200" };
  }

  return { text: "Risky", tone: "text-rose-700 bg-rose-50 border-rose-200" };
}
