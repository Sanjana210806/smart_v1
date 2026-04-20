import { Router, type IRouter } from "express";
import { getParkingAreas } from "../lib/store";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

/** List all parking sites (mall / metro / office) with level names for the UI. */
router.get("/areas", requireAuth, (_req, res): void => {
  res.json(getParkingAreas());
});

export default router;
