import { describe, expect, it } from "vitest";
import { recommendParkingSlots } from "./recommend-slots";
import type { ParkingSlot } from "./types";
import { buildSeedSlots } from "./seed";

function slotsOnLevel(level: string) {
  return buildSeedSlots().filter((s) => s.level === level);
}

const A = "area-test";

/** Minimal fixtures for precise permutation tests */
const mixedFixture: ParkingSlot[] = [
  {
    areaId: A,
    slotId: "B1-01",
    level: "B1",
    slotType: "ev",
    available: true,
    isPaid: false,
    pricePerHour: 80,
    nearLift: true,
  },
  {
    areaId: A,
    slotId: "B1-02",
    level: "B1",
    slotType: "ev",
    available: true,
    isPaid: false,
    pricePerHour: 80,
    nearLift: false,
  },
  {
    areaId: A,
    slotId: "B1-03",
    level: "B1",
    slotType: "accessible",
    available: true,
    isPaid: false,
    pricePerHour: 0,
    nearLift: true,
  },
  {
    areaId: A,
    slotId: "B2-01",
    level: "B2",
    slotType: "ev",
    available: true,
    isPaid: false,
    pricePerHour: 80,
    nearLift: false,
  },
  {
    areaId: A,
    slotId: "GF-01",
    level: "GF",
    slotType: "premium",
    available: true,
    isPaid: true,
    pricePerHour: 120,
    nearLift: true,
  },
];

describe("recommendParkingSlots", () => {
  it("returns only matching rows for a level + EV + free (no padding from other levels)", () => {
    const r = recommendParkingSlots(mixedFixture, {
      needsEv: true,
      needsAccessible: false,
      parkingPreference: "free",
      preferredLevel: "B1",
    });
    expect(r).toHaveLength(2);
    expect(r.every((s) => s.level === "B1" && s.slotType === "ev")).toBe(true);
  });

  it("returns a single accessible slot on a level when that is all that matches", () => {
    const r = recommendParkingSlots(mixedFixture, {
      needsEv: false,
      needsAccessible: true,
      parkingPreference: "best",
      preferredLevel: "B1",
    });
    expect(r).toHaveLength(1);
    expect(r[0].slotId).toBe("B1-03");
  });

  it("does not fill to 5 when fewer than 5 qualify (2 EV on B1 only)", () => {
    const r = recommendParkingSlots(mixedFixture, {
      needsEv: true,
      needsAccessible: false,
      parkingPreference: "best",
      preferredLevel: "B1",
    });
    expect(r).toHaveLength(2);
  });

  it("prioritises accessible over EV when both flags are set", () => {
    const r = recommendParkingSlots(mixedFixture, {
      needsEv: true,
      needsAccessible: true,
      parkingPreference: "best",
      preferredLevel: "B1",
    });
    expect(r).toHaveLength(1);
    expect(r[0].slotType).toBe("accessible");
  });

  it("combines paid preference with level (premium on GF)", () => {
    const r = recommendParkingSlots(mixedFixture, {
      needsEv: false,
      needsAccessible: false,
      parkingPreference: "paid",
      preferredLevel: "GF",
    });
    expect(r).toHaveLength(1);
    expect(r[0].slotId).toBe("GF-01");
  });

  it("returns empty for impossible combinations (paid + EV in fixture)", () => {
    const r = recommendParkingSlots(mixedFixture, {
      needsEv: true,
      needsAccessible: false,
      parkingPreference: "paid",
      preferredLevel: "B1",
    });
    expect(r).toHaveLength(0);
  });

  it("caps at maxResults", () => {
    const r = recommendParkingSlots(buildSeedSlots(), {
      needsEv: false,
      needsAccessible: false,
      parkingPreference: "best",
      preferredLevel: undefined,
    }, { maxResults: 3 });
    expect(r).toHaveLength(3);
  });

  it("seed: B1 + accessible + free yields accessible free slots on B1 only (not padded to 5)", () => {
    const match = slotsOnLevel("B1").filter((s) => s.slotType === "accessible" && !s.isPaid);
    const r = recommendParkingSlots(buildSeedSlots(), {
      needsEv: false,
      needsAccessible: true,
      parkingPreference: "free",
      preferredLevel: "B1",
    });
    expect(r.length).toBe(Math.min(5, match.length));
    expect(r.every((s) => s.level === "B1" && s.slotType === "accessible" && !s.isPaid)).toBe(true);
  });

  it("seed: B1 + EV + free yields free EV slots on B1 only", () => {
    const match = slotsOnLevel("B1").filter((s) => s.slotType === "ev" && !s.isPaid);
    const r = recommendParkingSlots(buildSeedSlots(), {
      needsEv: true,
      needsAccessible: false,
      parkingPreference: "free",
      preferredLevel: "B1",
    });
    expect(r.length).toBe(Math.min(5, match.length));
    expect(r.every((s) => s.level === "B1" && s.slotType === "ev" && !s.isPaid)).toBe(true);
  });

  it("seed: paid + EV on B1 returns paid EV slots (seed includes multiple paid EV)", () => {
    const match = slotsOnLevel("B1").filter((s) => s.slotType === "ev" && s.isPaid);
    const r = recommendParkingSlots(buildSeedSlots(), {
      needsEv: true,
      needsAccessible: false,
      parkingPreference: "paid",
      preferredLevel: "B1",
    });
    expect(r.length).toBe(Math.min(5, match.length));
    expect(r.every((s) => s.slotType === "ev" && s.isPaid)).toBe(true);
  });

  it("seed: best + L2 returns only L2 slots, at most 5, tiered (standards before EV in full list)", () => {
    const full = recommendParkingSlots(buildSeedSlots(), {
      needsEv: false,
      needsAccessible: false,
      parkingPreference: "best",
      preferredLevel: "L2",
    }, { maxResults: 12 });
    const evIdx = full.findIndex((s) => s.slotType === "ev");
    const stdIdx = full.findIndex((s) => s.slotType === "standard");
    expect(stdIdx).not.toBe(-1);
    expect(evIdx).not.toBe(-1);
    expect(stdIdx).toBeLessThan(evIdx);

    const r = recommendParkingSlots(buildSeedSlots(), {
      needsEv: false,
      needsAccessible: false,
      parkingPreference: "best",
      preferredLevel: "L2",
    });
    expect(r.length).toBe(5);
    expect(r.every((s) => s.level === "L2")).toBe(true);
    expect(r.every((s) => s.slotType === "standard")).toBe(true);
  });

  it("seed: accessible + easy (near lift) ANDs both — only accessible bays near lift", () => {
    const r = recommendParkingSlots(buildSeedSlots(), {
      needsEv: false,
      needsAccessible: true,
      needsEasy: true,
      parkingPreference: "best",
      preferredLevel: "B1",
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.slotType === "accessible" && s.nearLift)).toBe(true);
  });
});
