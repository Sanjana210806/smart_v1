import { Router, type IRouter } from "express";
import {
  findActiveSessionByCarNumber,
  findSessionByIdInArea,
  getUserCars,
  getAllSessionsForArea,
  isCarOwnedByUser,
  getSlotByAreaAndId,
  insertSession,
  setSlotAvailableForArea,
  updateSessionFull,
} from "../lib/store";
import { bookSlotBodySchema, getMyCarQuerySchema, getSessionsQuerySchema, sessionIdParamSchema } from "../lib/schemas";
import type { ParkingAreaKind, ParkingSession } from "../lib/types";
import { requireAuth, requireRole } from "../middleware/auth";
import { normalizeCarNumber } from "../lib/car-number";

const router: IRouter = Router();

/** Generate text-based route directions for a slot, tuned by site type. */
function generateRouteSteps(level: string, slotId: string, kind: ParkingAreaKind): string {
  if (kind === "metro") {
    return `Enter metro parking from the blue METRO entrance → Follow signs to ${level} (platform deck) → Locate pillar markers → Slot ${slotId}. Exit: follow EXIT / P+R signs to the fare gates and ramp.`;
  }
  if (kind === "office") {
    return `Enter campus vehicle gate → Show badge if prompted → Take the garage ramp to ${level} → Slot ${slotId} is on the signed bay row. Exit: reverse to the ramp → exit arm at security.`;
  }
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

function generateQrData(sessionId: number, carNumber: string, slotId: string, feeInr: number): string {
  return JSON.stringify({ sessionId, carNumber, slotId, feeInr, ts: Date.now() });
}

function calculateFeeInr(parkingStartTime: Date | null, pricePerHour: number): number {
  if (!parkingStartTime || pricePerHour === 0) return 0;
  const diffMs = Date.now() - parkingStartTime.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  return Math.ceil(diffHrs) * pricePerHour;
}

function enrichSession(session: ParkingSession) {
  const slot = getSlotByAreaAndId(session.areaId, session.slotId) ?? null;

  let durationMinutes: number | null = null;
  if (session.parkingStartTime) {
    const endTime = session.exitTime ? new Date(session.exitTime) : new Date();
    durationMinutes = Math.round((endTime.getTime() - new Date(session.parkingStartTime).getTime()) / 60000);
  }

  return { ...session, slot, durationMinutes };
}

function isAdmin(req: { auth?: { role: "admin" | "user" } }): boolean {
  return req.auth?.role === "admin";
}

function rejectIfUserNotOwner(req: { auth?: { role: "admin" | "user"; username: string } }, session: ParkingSession): string | undefined {
  if (!isAdmin(req) && req.auth?.username !== session.userId) {
    return "You can only access your own parking sessions";
  }
  return undefined;
}

router.get("/sessions", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const query = getSessionsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  let sessions = [...getAllSessionsForArea(areaId)];

  if (req.auth!.role === "user") {
    sessions = sessions.filter((s) => s.userId === req.auth!.username);
    if (query.data.status) {
      sessions = sessions.filter((s) => s.paymentStatus === query.data.status);
    }
  } else {
    if (query.data.userId) {
      sessions = sessions.filter((s) => s.userId === query.data.userId);
    }
    if (query.data.status) {
      sessions = sessions.filter((s) => s.paymentStatus === query.data.status);
    }
  }

  const enriched = sessions.map(enrichSession);
  res.json(enriched);
});

router.post("/book", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const parsed = bookSlotBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const area = req.parkingArea!;
  const areaId = area.areaId;
  const { carNumber, slotId } = parsed.data;
  const userId = req.auth!.username;
  const normalizedCarNumber = normalizeCarNumber(carNumber);
  if (!normalizedCarNumber) {
    res.status(400).json({ error: "Invalid car number", code: "INVALID_CAR_NUMBER" });
    return;
  }

  if (!isAdmin(req) && !isCarOwnedByUser(userId, normalizedCarNumber)) {
    res.status(403).json({
      error: "This car number is not linked to your account. Add it in My Cars first.",
      code: "CAR_NOT_LINKED_TO_USER",
      carNumber: normalizedCarNumber,
    });
    return;
  }

  const activeCarSession = findActiveSessionByCarNumber(normalizedCarNumber);
  if (activeCarSession) {
    res.status(409).json({
      error: "This car already has an active booking in another session. Exit or complete it first.",
      code: "CAR_ALREADY_ACTIVE",
      carNumber: normalizedCarNumber,
      activeSession: activeCarSession,
    });
    return;
  }

  const slot = getSlotByAreaAndId(areaId, slotId);

  if (!slot) {
    res.status(404).json({
      error: `No slot exists with id "${slotId}" in this parking area.`,
      code: "SLOT_NOT_FOUND",
      slotId,
      areaId,
    });
    return;
  }
  if (!slot.available) {
    res.status(409).json({
      error:
        "This slot is no longer available — it may already be booked or occupied. Refresh recommendations and choose another slot.",
      code: "SLOT_UNAVAILABLE",
      slotId,
    });
    return;
  }

  const routeSteps = generateRouteSteps(slot.level, slotId, area.kind);

  setSlotAvailableForArea(areaId, slotId, false);

  const tempQrData = JSON.stringify({
    type: "booking",
    areaId,
    carNumber,
    slotId,
    level: slot.level,
    ts: Date.now(),
  });

  const session = insertSession({
    areaId,
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
  });
  res.status(201).json(enrichSession(session));
});

router.post("/sessions/:sessionId/start", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  const session = findSessionByIdInArea(params.data.sessionId, areaId);

  if (!session) {
    res.status(404).json({ error: "Session not found in this parking area" });
    return;
  }
  const deny = rejectIfUserNotOwner(req, session);
  if (deny) {
    res.status(403).json({ error: deny, code: "FORBIDDEN_SESSION" });
    return;
  }

  const slot = getSlotByAreaAndId(areaId, session.slotId);

  const qrData = generateQrData(session.sessionId, session.carNumber, session.slotId, slot?.pricePerHour ?? 0);

  const updated: ParkingSession = {
    ...session,
    parkingStartTime: new Date().toISOString(),
    paymentStatus: "parked",
    qrData,
  };
  updateSessionFull(updated);
  res.json(enrichSession(updated));
});

router.get("/sessions/:sessionId/fee", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  const session = findSessionByIdInArea(params.data.sessionId, areaId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const deny = rejectIfUserNotOwner(req, session);
  if (deny) {
    res.status(403).json({ error: deny, code: "FORBIDDEN_SESSION" });
    return;
  }

  const slot = getSlotByAreaAndId(areaId, session.slotId);

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

router.post("/sessions/:sessionId/exit", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  const session = findSessionByIdInArea(params.data.sessionId, areaId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const deny = rejectIfUserNotOwner(req, session);
  if (deny) {
    res.status(403).json({ error: deny, code: "FORBIDDEN_SESSION" });
    return;
  }

  const slot = getSlotByAreaAndId(areaId, session.slotId);

  const pricePerHour = slot?.pricePerHour ?? 0;
  const startTime = session.parkingStartTime ? new Date(session.parkingStartTime) : null;
  const finalFee = calculateFeeInr(startTime, pricePerHour);

  const now = new Date();

  if (slot) {
    setSlotAvailableForArea(areaId, session.slotId, true);
  }

  const completed: ParkingSession = {
    ...session,
    exitTime: now.toISOString(),
    estimatedFee: finalFee,
    paymentStatus: "completed",
  };
  updateSessionFull(completed);
  res.json(enrichSession(completed));
});

router.get("/sessions/:sessionId", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const params = sessionIdParamSchema.safeParse({ sessionId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  const session = findSessionByIdInArea(params.data.sessionId, areaId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const deny = rejectIfUserNotOwner(req, session);
  if (deny) {
    res.status(403).json({ error: deny, code: "FORBIDDEN_SESSION" });
    return;
  }

  res.json(enrichSession(session));
});

router.get("/my-car", requireAuth, requireRole("admin", "user"), async (req, res): Promise<void> => {
  const query = getMyCarQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const areaId = req.parkingArea!.areaId;
  let sessions = [...getAllSessionsForArea(areaId)];
  const role = req.auth!.role;
  const username = req.auth!.username;
  if (role === "admin") {
    if (query.data.userId) {
      sessions = sessions.filter((s) => s.userId === query.data.userId && s.paymentStatus !== "completed");
    } else if (query.data.carNumber) {
      const norm = normalizeCarNumber(query.data.carNumber);
      sessions = sessions.filter((s) => normalizeCarNumber(s.carNumber) === norm && s.paymentStatus !== "completed");
    }
  } else {
    sessions = sessions.filter((s) => s.userId === username && s.paymentStatus !== "completed");
    if (query.data.userId && query.data.userId !== username) {
      res.status(403).json({ error: "You can only query your own sessions", code: "FORBIDDEN_QUERY" });
      return;
    }
    if (query.data.carNumber) {
      const norm = normalizeCarNumber(query.data.carNumber);
      if (!isCarOwnedByUser(username, norm)) {
        res.status(403).json({
          error: "This car is not linked to your account",
          code: "CAR_NOT_LINKED_TO_USER",
        });
        return;
      }
      sessions = sessions.filter((s) => normalizeCarNumber(s.carNumber) === norm);
    }
  }

  if (sessions.length === 0) {
    res.json({ found: false, message: "No active parking session found in this area.", session: null });
    return;
  }

  const latest = sessions[sessions.length - 1];
  const enriched = enrichSession(latest);

  res.json({
    found: true,
    message: `Your car is parked at slot ${latest.slotId}`,
    session: enriched,
    linkedCars: role === "user" ? getUserCars(username).map((c) => c.carNumber) : undefined,
  });
});

export default router;
