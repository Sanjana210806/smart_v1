import type { ParkingAreaKind, ParkingSlot } from "./types";

/**
 * Three prototype sites: mall (multi-level retail), metro (park & ride), office (campus garage).
 * `areaId` is stable for URLs and foreign keys; `slug` is a readable path segment.
 */
export const LEGACY_DEFAULT_AREA_ID = "area-mall-01";

export type ParkingAreaDefinition = {
  areaId: string;
  slug: string;
  name: string;
  kind: ParkingAreaKind;
  levels: string[];
};

export const PARKING_AREA_DEFINITIONS: ParkingAreaDefinition[] = [
  {
    areaId: LEGACY_DEFAULT_AREA_ID,
    slug: "city-mall",
    name: "City Mall Parking",
    kind: "mall",
    levels: ["B1", "B2", "GF", "L1", "L2"],
  },
  {
    areaId: "area-metro-01",
    slug: "central-metro",
    name: "Central Metro Park & Ride",
    kind: "metro",
    levels: ["P1", "P2", "P3"],
  },
  {
    areaId: "area-office-01",
    slug: "tech-campus",
    name: "Tech Campus Garage",
    kind: "office",
    levels: ["G", "L1", "L2"],
  },
];

export const SLOTS_PER_LEVEL = 34;

type SlotDef = Pick<ParkingSlot, "slotType" | "isPaid" | "pricePerHour" | "nearLift">;

/** Fixed pattern repeated on every level (indices 0..33). */
const SLOT_PATTERN: SlotDef[] = [
  { slotType: "ev", isPaid: false, pricePerHour: 80, nearLift: true },
  { slotType: "ev", isPaid: false, pricePerHour: 80, nearLift: true },
  { slotType: "ev", isPaid: true, pricePerHour: 100, nearLift: true },
  { slotType: "ev", isPaid: false, pricePerHour: 80, nearLift: false },
  { slotType: "ev", isPaid: true, pricePerHour: 110, nearLift: false },
  { slotType: "ev", isPaid: false, pricePerHour: 80, nearLift: true },
  { slotType: "ev", isPaid: true, pricePerHour: 105, nearLift: false },
  { slotType: "ev", isPaid: false, pricePerHour: 80, nearLift: false },
  { slotType: "accessible", isPaid: false, pricePerHour: 0, nearLift: true },
  { slotType: "accessible", isPaid: false, pricePerHour: 0, nearLift: true },
  { slotType: "accessible", isPaid: true, pricePerHour: 55, nearLift: true },
  { slotType: "accessible", isPaid: false, pricePerHour: 0, nearLift: false },
  { slotType: "accessible", isPaid: true, pricePerHour: 65, nearLift: false },
  { slotType: "accessible", isPaid: false, pricePerHour: 0, nearLift: false },
  { slotType: "accessible", isPaid: true, pricePerHour: 60, nearLift: false },
  ...Array.from({ length: 11 }, (_, j) => ({
    slotType: "standard" as const,
    isPaid: false,
    pricePerHour: 0,
    nearLift: j < 4,
  })),
  ...Array.from({ length: 8 }, (_, j) => ({
    slotType: "premium" as const,
    isPaid: true,
    pricePerHour: 120 + (j % 3) * 10,
    nearLift: j < 2,
  })),
];

if (SLOT_PATTERN.length !== SLOTS_PER_LEVEL) {
  throw new Error(`SLOT_PATTERN length ${SLOT_PATTERN.length} must equal SLOTS_PER_LEVEL ${SLOTS_PER_LEVEL}`);
}

/** Slots for one parking area (SQLite seed and tests). */
export function buildSlotsForArea(areaId: string, levels: string[]): ParkingSlot[] {
  return levels.flatMap((level) =>
    SLOT_PATTERN.map((def, i) => {
      const num = String(i + 1).padStart(2, "0");
      return {
        areaId,
        slotId: `${level}-${num}`,
        level,
        slotType: def.slotType,
        available: true,
        isPaid: def.isPaid,
        pricePerHour: def.pricePerHour,
        nearLift: def.nearLift,
      };
    }),
  );
}

/** Default seed shape for tests — first defined area (mall). */
export function buildSeedSlots(): ParkingSlot[] {
  const first = PARKING_AREA_DEFINITIONS[0];
  return buildSlotsForArea(first.areaId, first.levels);
}
