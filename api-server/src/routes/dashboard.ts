import { Router, type IRouter } from "express";
import { parkingSessions, parkingSlots } from "../lib/store";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  const slots = parkingSlots;
  const sessions = parkingSessions;

  const totalSlots = slots.length;
  const availableSlots = slots.filter((s) => s.available).length;
  const occupiedSlots = totalSlots - availableSlots;

  const evSlots = slots.filter((s) => s.slotType === "ev").length;
  const evAvailable = slots.filter((s) => s.slotType === "ev" && s.available).length;

  const accessibleSlots = slots.filter((s) => s.slotType === "accessible").length;
  const accessibleAvailable = slots.filter((s) => s.slotType === "accessible" && s.available).length;

  const paidSlots = slots.filter((s) => s.isPaid && s.available).length;

  const activeSessions = sessions.filter((s) => s.paymentStatus === "parked").length;

  // Revenue today = sum of completed session fees today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completedToday = sessions.filter(
    (s) =>
      s.paymentStatus === "completed" &&
      s.exitTime &&
      new Date(s.exitTime) >= todayStart
  );
  const revenueTodayInr = completedToday.reduce((sum, s) => sum + (s.estimatedFee ?? 0), 0);

  // Average duration in minutes
  const sessionsWithDuration = sessions.filter((s) => s.parkingStartTime && (s.exitTime || s.paymentStatus === "parked"));
  const totalDurationMin = sessionsWithDuration.reduce((sum, s) => {
    const start = new Date(s.parkingStartTime!).getTime();
    const end = s.exitTime ? new Date(s.exitTime).getTime() : Date.now();
    return sum + Math.round((end - start) / 60000);
  }, 0);
  const averageDurationMinutes = sessionsWithDuration.length > 0
    ? Math.round(totalDurationMin / sessionsWithDuration.length)
    : 0;

  const levels = ["B1", "B2", "GF", "L1", "L2"];
  const levelBreakdown = levels.map((level) => {
    const levelSlots = slots.filter((s) => s.level === level);
    const available = levelSlots.filter((s) => s.available).length;
    return { level, total: levelSlots.length, available, occupied: levelSlots.length - available };
  });

  res.json({
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
