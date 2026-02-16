/**
 * Suggests the next focus session length based on cognitive load during the last block.
 * Uses display_score values (already transformed by server) for consistency with the chart.
 *
 * Formula: adjustment = (50 - avg) * 0.12, clamped to ±5 min
 */
export function suggestNextSessionLength(
  baseLengthMin: number,
  displayScores: number[],
  minLength = 15,
  maxLength = 45
): number {
  if (displayScores.length === 0) return baseLengthMin;

  const avg =
    displayScores.reduce((a, b) => a + b, 0) / displayScores.length;
  const adjustment = (50 - avg) * 0.12;
  const clamped = Math.max(-5, Math.min(5, adjustment));
  return Math.max(
    minLength,
    Math.min(maxLength, Math.round(baseLengthMin + clamped))
  );
}
