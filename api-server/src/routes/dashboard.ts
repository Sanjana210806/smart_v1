import { Router, type IRouter } from "express";
import { getAllSessionsForArea, getAllSlotsForArea } from "../lib/store";
import { requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

/** Operations metrics for one parking site only (switch area in the app header). */
router.get("/dashboard", ...requireAdmin, async (req, res): Promise<void> => {
  const area = req.parkingArea!;
  const areaId = area.areaId;
  const slots = getAllSlotsForArea(areaId);
  const sessions = getAllSessionsForArea(areaId);

  const totalSlots = slots.length;
  const availableSlots = slots.filter((s) => s.available).length;
  const occupiedSlots = totalSlots - availableSlots;

  const evSlots = slots.filter((s) => s.slotType === "ev").length;
  const evAvailable = slots.filter((s) => s.slotType === "ev" && s.available).length;

  const accessibleSlots = slots.filter((s) => s.slotType === "accessible").length;
  const accessibleAvailable = slots.filter((s) => s.slotType === "accessible" && s.available).length;

  const paidSlots = slots.filter((s) => s.isPaid && s.available).length;

  const activeSessions = sessions.filter((s) => s.paymentStatus === "parked").length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completedToday = sessions.filter(
    (s) =>
      s.paymentStatus === "completed" &&
      s.exitTime &&
      new Date(s.exitTime) >= todayStart
  );
  const revenueTodayInr = completedToday.reduce((sum, s) => sum + (s.estimatedFee ?? 0), 0);

  const sessionsWithDuration = sessions.filter((s) => s.parkingStartTime && (s.exitTime || s.paymentStatus === "parked"));
  const totalDurationMin = sessionsWithDuration.reduce((sum, s) => {
    const start = new Date(s.parkingStartTime!).getTime();
    const end = s.exitTime ? new Date(s.exitTime).getTime() : Date.now();
    return sum + Math.round((end - start) / 60000);
  }, 0);
  const averageDurationMinutes = sessionsWithDuration.length > 0
    ? Math.round(totalDurationMin / sessionsWithDuration.length)
    : 0;

  const levelOrder = [...area.levels];
  const levelBreakdown = levelOrder.map((level) => {
    const levelSlots = slots.filter((s) => s.level === level);
    const available = levelSlots.filter((s) => s.available).length;
    return { level, total: levelSlots.length, available, occupied: levelSlots.length - available };
  });

  res.json({
    area: {
      areaId: area.areaId,
      slug: area.slug,
      name: area.name,
      kind: area.kind,
    },
    totalSlots,
    availableSlots,
    occupiedSlots,
    evSlots,
    evAvailable,
    accessibleSlots,
    accessibleAvailable,
    paidSlots,
    activeSessions,
    revenueTodayInr,
    averageDurationMinutes,
    levelBreakdown,
  });
});

export default router;
