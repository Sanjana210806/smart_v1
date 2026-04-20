import type { RequestHandler } from "express";
import { getParkingAreaByIdOrSlug } from "../lib/store";

/**
 * Resolves `:areaId` from the path (supports numeric id or slug, e.g. `city-mall`).
 * Attaches `req.parkingArea` for nested area-scoped routes.
 */
export const attachParkingArea: RequestHandler = (req, res, next) => {
  const raw = req.params.areaId;
  const key = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const area = getParkingAreaByIdOrSlug(key);
  if (!area) {
    res.status(404).json({
      error: `Unknown parking area "${key}". Use GET /api/areas to list valid sites.`,
      code: "AREA_NOT_FOUND",
    });
    return;
  }
  req.parkingArea = area;
  next();
};
