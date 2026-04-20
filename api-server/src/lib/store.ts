/**
 * Persistence is SQLite (via sql.js) in `database.ts`.
 */
export {
  initDatabase,
  getParkingAreas,
  getParkingAreaByIdOrSlug,
  getAllSlotsForArea,
  getSlotByAreaAndId,
  setSlotAvailableForArea,
  getAllSessionsForArea,
  getAllSessionsForUser,
  findSessionByIdInArea,
  insertSession,
  updateSessionFull,
  getUserCars,
  addUserCar,
  removeUserCar,
  isCarOwnedByUser,
  findActiveSessionByCarNumber,
  listUsersWithCarCounts,
  userExists,
  createUser,
  resolveDbPath,
  type ParkingAreaSummary,
  type UserCar,
  type ActiveCarSession,
  type UserSummaryRow,
} from "./database";

import { initDatabase } from "./database";

export async function initializeStore(): Promise<void> {
  await initDatabase();
}
