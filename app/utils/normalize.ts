/**
 * Normalize a Hebrew item name to match the backend normalization rules.
 * Used when writing to manual_overrides so cache lookups match.
 */
export function normalize(name: string): string {
  if (typeof name !== "string" || name.trim() === "") {
    return "";
  }

  let result = name.trim();

  // Collapse runs of whitespace to a single space
  result = result.replace(/\s+/g, " ");

  // Hebrew variants: triple-vav → single vav
  result = result.replace(/ווי/g, "ו");

  // Hebrew variants: double-yod → single yod
  result = result.replace(/יי/g, "י");

  return result;
}
