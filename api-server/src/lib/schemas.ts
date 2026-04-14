import { z } from "zod";

export const healthCheckResponseSchema = z.object({
  status: z.literal("ok"),
});

export const getSlotsQuerySchema = z.object({
  level: z.string().optional(),
  slotType: z.string().optional(),
});

export const recommendSlotsBodySchema = z.object({
  needsEv: z.boolean().optional().default(false),
  needsAccessible: z.boolean().optional().default(false),
  parkingPreference: z.enum(["free", "paid", "best"]).optional().default("best"),
  preferredLevel: z.enum(["B1", "B2", "GF", "L1", "L2", "any"]).optional(),
});

export const bookSlotBodySchema = z.object({
  userId: z.string().min(1),
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
