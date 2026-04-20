import { Router, type IRouter } from "express";
import { addUserCar, getUserCars, removeUserCar } from "../lib/store";
import { carNumberParamSchema, upsertCarBodySchema } from "../lib/schemas";
import { requireAuth, requireRole } from "../middleware/auth";

const router: IRouter = Router();

router.get("/me/cars", requireAuth, requireRole("admin", "user"), (req, res): void => {
  const cars = getUserCars(req.auth!.username);
  res.json(cars);
});

router.post("/me/cars", requireAuth, requireRole("admin", "user"), (req, res): void => {
  const parsed = upsertCarBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const car = addUserCar(req.auth!.username, parsed.data.carNumber);
    res.status(201).json(car);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid car number",
    });
  }
});

router.delete("/me/cars/:carNumber", requireAuth, requireRole("admin", "user"), (req, res): void => {
  const raw = Array.isArray(req.params.carNumber) ? req.params.carNumber[0] : req.params.carNumber;
  const parsed = carNumberParamSchema.safeParse({ carNumber: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const removed = removeUserCar(req.auth!.username, parsed.data.carNumber);
  if (removed === 0) {
    res.status(404).json({ error: "Car not found for this user" });
    return;
  }
  res.json({ ok: true, removed });
});

export default router;

