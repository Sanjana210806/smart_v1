import { Router, type IRouter } from "express";
import { getAllSlotsForArea } from "../lib/store";
import { recommendSlotsBodySchema } from "../lib/schemas";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  echoRecommendFilters,
  MAX_TOP_RECOMMENDATIONS,
  noMatchingSlotsMessage,
  recommendParkingSlots,
} from "../lib/recommend-slots";

const router: IRouter = Router();

/**
 * RULE-BASED RECOMMENDATION — all parameters apply together (AND).
 * Returns up to MAX_TOP_RECOMMENDATIONS matches (never padded from other levels).
 */
router.post("/recommend", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const parsed = recommendSlotsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const params = parsed.data;
  const filters = echoRecommendFilters(params);

  const areaId = req.parkingArea!.areaId;
  const slots = recommendParkingSlots(getAllSlotsForArea(areaId), params, {
    maxResults: MAX_TOP_RECOMMENDATIONS,
  });

  if (slots.length === 0) {
    res.status(200).json({
      found: false,
      code: "NO_MATCHING_SLOTS",
      message: noMatchingSlotsMessage(params),
      slots: [],
      limit: MAX_TOP_RECOMMENDATIONS,
      matchCount: 0,
      filters,
    });
    return;
  }

  res.status(200).json({
    found: true,
    code: "OK",
    message: `Top ${MAX_TOP_RECOMMENDATIONS} recommendations — showing ${slots.length} available slot${slots.length > 1 ? "s" : ""} that match your preferences.`,
    slots,
    limit: MAX_TOP_RECOMMENDATIONS,
    matchCount: slots.length,
    filters,
  });
});

export default router;
