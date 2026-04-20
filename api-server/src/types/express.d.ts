import type { Role } from "../lib/jwt";
import type { ParkingAreaSummary } from "../lib/database";

declare global {
  namespace Express {
    interface Request {
      auth?: { username: string; role: Role };
      parkingArea?: ParkingAreaSummary;
    }
  }
}

export {};
