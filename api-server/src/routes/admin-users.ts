import { Router, type IRouter } from "express";
import {
  addUserCar,
  createUser,
  getUserCars,
  listUsersWithCarCounts,
  userExists,
} from "../lib/store";
import { createAdminUserBodySchema } from "../lib/schemas";
import { requireAdmin } from "../middleware/auth";
import { hashPassword } from "../lib/password";
import { normalizeCarNumber } from "../lib/car-number";

const router: IRouter = Router();

/** List all accounts (admin only). */
router.get("/admin/users", ...requireAdmin, (_req, res): void => {
  res.json(listUsersWithCarCounts());
});

/**
 * Create a new user account (admin only).
 * Body is fully validated; optional `cars` seeds `user_cars` for drivers.
 */
router.post("/admin/users", ...requireAdmin, (req, res): void => {
  const parsed = createAdminUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { username, password, role, cars: rawCars } = parsed.data;
  const usernameKey = username.trim().toLowerCase();

  const seenNorm = new Set<string>();
  const cars: string[] = [];
  for (const plate of rawCars) {
    const norm = normalizeCarNumber(plate);
    if (!norm || seenNorm.has(norm)) continue;
    seenNorm.add(norm);
    cars.push(plate.trim().toUpperCase());
  }

  if (userExists(usernameKey)) {
    res.status(409).json({
      error: `Username "${usernameKey}" is already taken.`,
      code: "USERNAME_TAKEN",
    });
    return;
  }

  for (const plate of cars) {
    if (!normalizeCarNumber(plate)) {
      res.status(400).json({
        error: `Invalid car plate: "${plate}". Use letters and digits (spaces/hyphens allowed).`,
        code: "INVALID_CAR_PLATE",
      });
      return;
    }
  }

  if (role === "user" && cars.length === 0) {
    res.status(400).json({
      error: "Driver accounts need at least one valid car plate after normalization.",
      code: "INVALID_CARS",
    });
    return;
  }

  try {
    createUser(usernameKey, hashPassword(password), role);
  } catch {
    res.status(500).json({ error: "Could not create user", code: "USER_CREATE_FAILED" });
    return;
  }

  for (const plate of cars) {
    try {
      addUserCar(usernameKey, plate);
    } catch {
      res.status(201).json({
        user: { username: usernameKey, role },
        cars: getUserCars(usernameKey),
        warning: "User was created but at least one car plate could not be linked.",
      });
      return;
    }
  }

  res.status(201).json({
    user: { username: usernameKey, role },
    cars: getUserCars(usernameKey),
  });
});

export default router;
