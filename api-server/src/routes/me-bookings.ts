import { Router, type IRouter } from "express";
import {
  getAllSessionsForUser,
  getParkingAreaByIdOrSlug,
  getSlotByAreaAndId,
} from "../lib/store";
import type { ParkingSession } from "../lib/types";
import { requireAuth, requireRole } from "../middleware/auth";

const router: IRouter = Router();

function enrichBookingRow(session: ParkingSession) {
  const slot = getSlotByAreaAndId(session.areaId, session.slotId) ?? null;
  let durationMinutes: number | null = null;
  if (session.parkingStartTime) {
    const endTime = session.exitTime ? new Date(session.exitTime) : new Date();
    durationMinutes = Math.round(
      (endTime.getTime() - new Date(session.parkingStartTime).getTime()) / 60000,
    );
  }
  const area = getParkingAreaByIdOrSlug(session.areaId);
  return {
    ...session,
    slot,
    durationMinutes,
    areaName: area?.name ?? session.areaId,
  };
}

/** Signed-in user's bookings across all parking areas (user-centric history). */
router.get("/me/bookings", requireAuth, requireRole("admin", "user"), (req, res): void => {
  const sessions = getAllSessionsForUser(req.auth!.username);
  res.json(sessions.map(enrichBookingRow));
});

export default router;
