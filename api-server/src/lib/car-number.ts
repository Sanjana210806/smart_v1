/**
 * Normalize plate text for identity checks and uniqueness:
 * - uppercase
 * - keep only A-Z and 0-9
 */
export function normalizeCarNumber(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

