import type { ParkingSession, ParkingSlot } from "./types";

const levels = ["B1", "B2", "GF", "L1", "L2"];

function buildSeedSlots(): ParkingSlot[] {
  return levels.flatMap((level) =>
    Array.from({ length: 12 }, (_, i) => {
      const num = String(i + 1).padStart(2, "0");
      const slotType = i < 2 ? "ev" : i === 2 ? "accessible" : i >= 10 ? "premium" : "standard";
      const isPaid = slotType === "premium";
      return {
        slotId: `${level}-${num}`,
        level,
        slotType,
        available: true,
        isPaid,
        pricePerHour: slotType === "premium" ? 120 : slotType === "ev" ? 80 : 0,
        nearLift: i < 4,
      };
    }),
  );
}

export const parkingSlots: ParkingSlot[] = buildSeedSlots();
export const parkingSessions: ParkingSession[] = [];
export let nextSessionId = 1;

export function initializeStore(): void {
  if (parkingSlots.length === 0) {
    parkingSlots.push(...buildSeedSlots());
  }
}

export function allocateSessionId(): number {
  const id = nextSessionId;
  nextSessionId += 1;
  return id;
}
