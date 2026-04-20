import type { ParkingSlot } from "./types";

/** Maximum recommendations returned by /api/recommend (never padded beyond real matches). */
export const MAX_TOP_RECOMMENDATIONS = 5;

export type RecommendParams = {
  needsEv: boolean;
  needsAccessible: boolean;
  /** When true, only slots with easy access (near lift). Default false. */
  needsEasy?: boolean;
  parkingPreference: "free" | "paid" | "best";
  /** Level code for the current parking area (mall / metro / office layouts differ). */
  preferredLevel?: string;
};

const sortByLift = (slots: ParkingSlot[]) =>
  [...slots].sort((a, b) => (b.nearLift ? 1 : 0) - (a.nearLift ? 1 : 0));

/**
 * "Best" ordering within an already-filtered set: unpaid standard first, then EV,
 * accessible, then premium — each group lift-first.
 */
function orderBestPreference(slots: ParkingSlot[]): ParkingSlot[] {
  const freeStandard = sortByLift(slots.filter((s) => s.slotType === "standard" && !s.isPaid));
  const evSlots = sortByLift(slots.filter((s) => s.slotType === "ev"));
  const accessibleSlots = sortByLift(slots.filter((s) => s.slotType === "accessible"));
  const premiumSlots = sortByLift(slots.filter((s) => s.slotType === "premium"));
  return [...freeStandard, ...evSlots, ...accessibleSlots, ...premiumSlots];
}

/**
 * Applies all four inputs together (AND): slot type → payment preference → level.
 * Returns at most `maxResults` rows — never padded from other levels or relaxed filters.
 */
export function recommendParkingSlots(
  allSlots: ParkingSlot[],
  params: RecommendParams,
  options: { maxResults?: number } = {},
): ParkingSlot[] {
  const maxResults = options.maxResults ?? MAX_TOP_RECOMMENDATIONS;
  const needsEasy = params.needsEasy ?? false;
  let filtered = allSlots.filter((s) => s.available);

  if (params.needsAccessible) {
    filtered = filtered.filter((s) => s.slotType === "accessible");
  } else if (params.needsEv) {
    filtered = filtered.filter((s) => s.slotType === "ev");
  }

  if (needsEasy) {
    filtered = filtered.filter((s) => s.nearLift);
  }

  if (params.parkingPreference === "free") {
    filtered = filtered.filter((s) => !s.isPaid);
  } else if (params.parkingPreference === "paid") {
    filtered = filtered.filter((s) => s.isPaid);
  }

  if (params.preferredLevel && params.preferredLevel !== "any") {
    filtered = filtered.filter((s) => s.level === params.preferredLevel);
  }

  const useBestOrdering =
    params.parkingPreference === "best" &&
    !params.needsAccessible &&
    !params.needsEv &&
    !needsEasy;

  const ordered = useBestOrdering ? orderBestPreference(filtered) : sortByLift(filtered);

  return ordered.slice(0, maxResults);
}

export function echoRecommendFilters(params: RecommendParams) {
  return {
    needsEv: params.needsEv,
    needsAccessible: params.needsAccessible,
    needsEasy: params.needsEasy ?? false,
    parkingPreference: params.parkingPreference,
    preferredLevel: params.preferredLevel ?? "any",
  };
}

/** User-facing message when no rows match all filters (AND). */
export function noMatchingSlotsMessage(params: RecommendParams): string {
  const needsEasy = params.needsEasy ?? false;
  const level =
    params.preferredLevel && params.preferredLevel !== "any"
      ? ` on level ${params.preferredLevel}`
      : "";
  let kind = "any available slot";
  if (params.needsAccessible && needsEasy) {
    kind = "an accessible space with easy access (near lift)";
  } else if (params.needsAccessible) {
    kind = "an accessible space";
  } else if (params.needsEv) {
    kind = "an EV charging space";
  } else if (needsEasy) {
    kind = "a space with easy access (near lift)";
  }

  let pay = "";
  if (params.parkingPreference === "free") pay = " (free only)";
  else if (params.parkingPreference === "paid") pay = " (premium / paid only)";

  return `No matching slots${level}: we could not find ${kind}${pay} with your current filters. Try another level, turn off EV, accessible, or easy access if you do not need them, or switch free/premium preference.`;
}
