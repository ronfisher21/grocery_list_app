import { normalize } from './normalize';

describe('normalize', () => {
  // Rule 4: Empty or non-string input -> ""
  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });

  it('returns empty string for non-string input', () => {
    expect(normalize(null as any)).toBe('');
    expect(normalize(undefined as any)).toBe('');
    expect(normalize(123 as any)).toBe('');
  });

  // Rule 1: Trim leading and trailing whitespace
  it('trims leading and trailing whitespace', () => {
    expect(normalize('  חלב  ')).toBe('חלב');
  });

  // Rule 2: Collapse runs of whitespace to a single space
  it('collapses multiple spaces to single space', () => {
    expect(normalize('חלב   עוגיות')).toBe('חלב עוגיות');
  });

  it('collapses tabs and newlines to single space', () => {
    expect(normalize('חלב\t\tעוגיות')).toBe('חלב עוגיות');
    expect(normalize('חלב\n\nעוגיות')).toBe('חלב עוגיות');
  });

  // Rules 1+2 combined (example from IMPLEMENTATION_PLAN.md)
  it('trims and collapses: "  חלב   עוגיות  " -> "חלב עוגיות"', () => {
    expect(normalize('  חלב   עוגיות  ')).toBe('חלב עוגיות');
  });

  // Rule 3a: Replace ווי -> ו (single vav)
  it('replaces ווי with ו', () => {
    expect(normalize('יוגורט ווי')).toBe('יוגורט ו');
  });

  // Rule 3b: Replace יי -> י (single yod)
  it('replaces יי with י', () => {
    expect(normalize('חלב ייבש')).toBe('חלב יבש');
  });

  // Combined example from IMPLEMENTATION_PLAN.md
  it('handles full example: "יוגורט ווי" -> "יוגורט ו"', () => {
    expect(normalize('יוגורט ווי')).toBe('יוגורט ו');
  });

  // All rules combined
  it('applies all rules together', () => {
    expect(normalize('  יוגורט   ווי  ')).toBe('יוגורט ו');
  });

  it('handles already-normalized input', () => {
    expect(normalize('חלב')).toBe('חלב');
  });

  it('handles whitespace-only input', () => {
    expect(normalize('   ')).toBe('');
  });
});
