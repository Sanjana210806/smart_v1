import { Router, type IRouter } from "express";
import { getAllSlotsForArea } from "../lib/store";
import { getSlotsQuerySchema } from "../lib/schemas";
import { requireAuth, requireRole } from "../middleware/auth";

const router: IRouter = Router();

router.get("/slots", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const query = getSlotsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  let slots = [...getAllSlotsForArea(areaId)];

  if (query.data.level) {
    slots = slots.filter((s) => s.level === query.data.level);
  }
  if (query.data.slotType) {
    slots = slots.filter((s) => s.slotType === query.data.slotType);
  }

  res.json(slots);
});

export default router;
