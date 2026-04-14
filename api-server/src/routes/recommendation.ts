import { Router, type IRouter } from "express";
import { parkingSlots } from "../lib/store";
import { recommendSlotsBodySchema } from "../lib/schemas";

const router: IRouter = Router();

/**
 * RULE-BASED RECOMMENDATION — Strictly deterministic priority chain:
 * 1. Accessible slot if needs_accessible
 * 2. EV slot if needs_ev
 * 3. Free preference → unpaid slots
 * 4. Paid preference → paid slots
 * 5. Preferred level → slots on that level
 * 6. Fallback → any available slot
 * Returns TOP 5 matches, near_lift preferred within each group
 */
router.post("/recommend", async (req, res): Promise<void> => {
  const parsed = recommendSlotsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { needsEv, needsAccessible, parkingPreference, preferredLevel } = parsed.data;

  const allAvailable = parkingSlots.filter((slot) => slot.available);

  // Sort: near_lift first within each group
  const sortByLift = (slots: typeof allAvailable) =>
    [...slots].sort((a, b) => (b.nearLift ? 1 : 0) - (a.nearLift ? 1 : 0));

  let candidates: typeof allAvailable = [];

  if (needsAccessible) {
    // Priority 1: accessible only
    candidates = sortByLift(allAvailable.filter((s) => s.slotType === "accessible"));
  } else if (needsEv) {
    // Priority 2: EV only
    candidates = sortByLift(allAvailable.filter((s) => s.slotType === "ev"));
  } else if (parkingPreference === "free") {
    // Priority 3: free (standard unpaid) slots only — no paid fallback
    candidates = sortByLift(allAvailable.filter((s) => !s.isPaid));
  } else if (parkingPreference === "paid") {
    // Priority 4: paid premium slots
    candidates = sortByLift(allAvailable.filter((s) => s.isPaid));
  } else if (preferredLevel && preferredLevel !== "any") {
    // Priority 5: preferred level (free slots on that level first, then paid)
    const levelSlots = allAvailable.filter((s) => s.level === preferredLevel);
    const freeLevelSlots = sortByLift(levelSlots.filter((s) => !s.isPaid));
    const paidLevelSlots = sortByLift(levelSlots.filter((s) => s.isPaid));
    candidates = [...freeLevelSlots, ...paidLevelSlots];
  } else {
    // "best" — free standard slots first (lift-priority), then EV/accessible, then premium
    const freeStandard = sortByLift(allAvailable.filter((s) => s.slotType === "standard"));
    const evSlots = sortByLift(allAvailable.filter((s) => s.slotType === "ev"));
    const accessibleSlots = sortByLift(allAvailable.filter((s) => s.slotType === "accessible"));
    const premiumSlots = sortByLift(allAvailable.filter((s) => s.slotType === "premium"));
    candidates = [...freeStandard, ...evSlots, ...accessibleSlots, ...premiumSlots];
  }

  // No extra fallback — if empty, return no results

  const top5 = candidates.slice(0, 5);

  if (top5.length === 0) {
    res.json({ found: false, message: "No parking slots available at this time. Please try again later.", slots: [] });
    return;
  }

  res.json({
    found: true,
    message: `Found ${top5.length} available slot${top5.length > 1 ? "s" : ""} matching your preferences.`,
    slots: top5,
  });
});

export default router;
