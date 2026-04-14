import { Router, type IRouter } from "express";
import { parkingSessions, parkingSlots, allocateSessionId } from "../lib/store";
import { bookSlotBodySchema, getMyCarQuerySchema, getSessionsQuerySchema, sessionIdParamSchema } from "../lib/schemas";
import type { ParkingSession } from "../lib/types";

const router: IRouter = Router();

/** Generate text-based route directions for a slot */
function generateRouteSteps(level: string, slotId: string): string {
  const levelDirections: Record<string, string> = {
    GF: "Enter main gate → Turn RIGHT at security booth → Continue 50m straight",
    B1: "Enter main gate → Take the DOWN ramp → B1 basement level",
    B2: "Enter main gate → Take the DOWN ramp twice → B2 basement level",
    L1: "Enter main gate → Take the UP ramp → L1 first upper level",
    L2: "Enter main gate → Take the UP ramp twice → L2 second upper level",
  };
  const base = levelDirections[level] ?? "Enter main gate → Follow signs";
  return `${base} → Turn LEFT at pillar → Look for slot ${slotId} → Park and press Start Parking. Exit: Reverse out → Follow EXIT signs → RIGHT at barrier → Main gate.`;
}

/** Generate QR data string */
function generateQrData(sessionId: number, carNumber: string, slotId: string, feeInr: number): string {
  return JSON.stringify({ sessionId, carNumber, slotId, feeInr, ts: Date.now() });
}

/** Calculate fee in INR: ceil((now - startTime) / 1hr) * pricePerHour */
function calculateFeeInr(parkingStartTime: Date | null, pricePerHour: number): number {
  if (!parkingStartTime || pricePerHour === 0) return 0;
  const diffMs = Date.now() - parkingStartTime.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  return Math.ceil(diffHrs) * pricePerHour;
}

/** Enrich session with slot data */
function enrichSession(session: ParkingSession) {
  const slot = parkingSlots.find((item) => item.slotId === session.slotId) ?? null;

  let durationMinutes: number | null = null;
  if (session.parkingStartTime) {
    const endTime = session.exitTime ? new Date(session.exitTime) : new Date();
    durationMinutes = Math.round((endTime.getTime() - new Date(session.parkingStartTime).getTime()) / 60000);
  }

  return { ...session, slot, durationMinutes };
}

// GET /sessions
router.get("/sessions", async (req, res): Promise<void> => {
  const query = getSessionsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let sessions = [...parkingSessions];

  if (query.data.userId) {
    sessions = sessions.filter((s) => s.userId === query.data.userId);
  }
  if (query.data.status) {
    sessions = sessions.filter((s) => s.paymentStatus === query.data.status);
  }

  const enriched = sessions.map(enrichSession);
  res.json(enriched);
});

// POST /book — book a slot (reservation, does NOT start billing)
router.post("/book", async (req, res): Promise<void> => {
  const parsed = bookSlotBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, carNumber, slotId } = parsed.data;

  const slot = parkingSlots.find((item) => item.slotId === slotId);

  if (!slot) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }
  if (!slot.available) {
    res.status(409).json({ error: "Slot is already occupied" });
    return;
  }

  const routeSteps = generateRouteSteps(slot.level, slotId);

  // Mark slot as occupied
  slot.available = false;

  // Generate a booking QR immediately (without fee — fee added at exit)
  const tempQrData = JSON.stringify({
    type: "booking",
    carNumber,
    slotId,
    level: slot.level,
    ts: Date.now(),
  });

  const session: ParkingSession = {
    sessionId: allocateSessionId(),
    userId,
    carNumber,
    slotId,
    bookingTime: new Date().toISOString(),
    parkingStartTime: null,
    exitTime: null,
    estimatedFee: null,
    paymentStatus: "pending",
    routeSteps,
    qrData: tempQrData,
  };
  parkingSessions.push(session);
  res.status(201).json(enrichSession(session));
});

// POST /sessions/:sessionId/start — start actual parking (billing begins)
router.post("/sessions/:sessionId/start", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = parkingSessions.find((item) => item.sessionId === params.data.sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const slot = parkingSlots.find((item) => item.slotId === session.slotId);

  const qrData = generateQrData(session.sessionId, session.carNumber, session.slotId, slot?.pricePerHour ?? 0);

  session.parkingStartTime = new Date().toISOString();
  session.paymentStatus = "parked";
  session.qrData = qrData;
  res.json(enrichSession(session));
});

// GET /sessions/:sessionId/fee — current fee in INR
router.get("/sessions/:sessionId/fee", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = parkingSessions.find((item) => item.sessionId === params.data.sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const slot = parkingSlots.find((item) => item.slotId === session.slotId);

  const pricePerHour = slot?.pricePerHour ?? 0;
  const startTime = session.parkingStartTime ? new Date(session.parkingStartTime) : null;
  const currentFeeInr = calculateFeeInr(startTime, pricePerHour);

  const durationMs = startTime ? Date.now() - startTime.getTime() : 0;
  const durationMinutes = Math.round(durationMs / 60000);

  const message = session.parkingStartTime
    ? `Parked for ${durationMinutes} min. Current fee: ₹${currentFeeInr}. Pay at exit.`
    : "Parking not started yet. Press Start Parking to begin.";

  res.json({
    sessionId: session.sessionId,
    slotId: session.slotId,
    parkingStartTime: session.parkingStartTime,
    durationMinutes,
    currentFeeInr,
    pricePerHour,
    paymentStatus: session.paymentStatus,
    message,
  });
});

// POST /sessions/:sessionId/exit — finalize and mark paid
router.post("/sessions/:sessionId/exit", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = parkingSessions.find((item) => item.sessionId === params.data.sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const slot = parkingSlots.find((item) => item.slotId === session.slotId);

  const pricePerHour = slot?.pricePerHour ?? 0;
  const startTime = session.parkingStartTime ? new Date(session.parkingStartTime) : null;
  const finalFee = calculateFeeInr(startTime, pricePerHour);

  const now = new Date();

  // Free up the slot
  if (slot) {
    slot.available = true;
  }

  session.exitTime = now.toISOString();
  session.estimatedFee = finalFee;
  session.paymentStatus = "completed";
  res.json(enrichSession(session));
});

// GET /sessions/:sessionId
router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = parkingSessions.find((item) => item.sessionId === params.data.sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(enrichSession(session));
});

// GET /my-car
router.get("/my-car", async (req, res): Promise<void> => {
  const query = getMyCarQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let sessions = [...parkingSessions];

  if (query.data.userId) {
    sessions = sessions.filter((s) => s.userId === query.data.userId && s.paymentStatus !== "completed");
  } else if (query.data.carNumber) {
    sessions = sessions.filter((s) => s.carNumber === query.data.carNumber && s.paymentStatus !== "completed");
  } else {
    res.json({ found: false, message: "Please provide userId or carNumber.", session: null });
    return;
  }

  if (sessions.length === 0) {
    res.json({ found: false, message: "No active parking session found.", session: null });
    return;
  }

  const latest = sessions[sessions.length - 1];
  const enriched = enrichSession(latest);

  res.json({
    found: true,
    message: `Your car is parked at slot ${latest.slotId}`,
    session: enriched,
  });
});

export default router;
