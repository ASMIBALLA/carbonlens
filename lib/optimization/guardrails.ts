export function canAutoAct(confidence_score: number) {
  if (confidence_score >= 0.8) return "AUTO";
  if (confidence_score >= 0.6) return "CONFIRM";
  return "RECOMMEND_ONLY";
}
