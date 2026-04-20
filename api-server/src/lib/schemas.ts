import { z } from "zod";

export const healthCheckResponseSchema = z.object({
  status: z.literal("ok"),
});

export const getSlotsQuerySchema = z.object({
  level: z.string().optional(),
  slotType: z.string().optional(),
});

/** Levels across all prototype sites (mall, metro, office). */
export const PREFERRED_LEVEL_VALUES = [
  "any",
  "B1",
  "B2",
  "GF",
  "L1",
  "L2",
  "P1",
  "P2",
  "P3",
  "G",
] as const;

export const recommendSlotsBodySchema = z.object({
  needsEv: z.boolean().optional().default(false),
  needsAccessible: z.boolean().optional().default(false),
  /** Prefer bays near lift / easy to reach (maps to `nearLift` on slots). */
  needsEasy: z.boolean().optional().default(false),
  parkingPreference: z.enum(["free", "paid", "best"]).optional().default("best"),
  preferredLevel: z.enum(PREFERRED_LEVEL_VALUES).optional(),
});

export const bookSlotBodySchema = z.object({
  /** Ignored when authenticated — server uses JWT subject as user id. */
  userId: z.string().optional(),
  carNumber: z.string().min(1),
  slotId: z.string().min(1),
});

export const getSessionsQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.enum(["pending", "parked", "completed"]).optional(),
});

export const getMyCarQuerySchema = z
  .object({
    userId: z.string().optional(),
    carNumber: z.string().optional(),
  })
  .refine((value) => Boolean(value.userId || value.carNumber), {
    message: "Please provide userId or carNumber.",
  });

export const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
});

export const upsertCarBodySchema = z.object({
  carNumber: z.string().min(1),
});

export const carNumberParamSchema = z.object({
  carNumber: z.string().min(1),
});

/** Admin-only: create a login with optional linked plates (same rules as `/api/me/cars`). */
export const createAdminUserBodySchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, "Username must be at least 2 characters")
      .max(64, "Username must be at most 64 characters")
      .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, digits, period, underscore, and hyphen"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    role: z.enum(["admin", "user"]),
    cars: z
      .array(z.string().trim().min(1, "Each car plate must be non-empty").max(32))
      .max(20, "At most 20 cars can be linked at creation")
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.role === "user" && (!data.cars || data.cars.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Drivers (role user) must have at least one linked car plate.",
        path: ["cars"],
      });
    }
  });
