import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type { ParkingAreaKind, ParkingAreaRow, ParkingSession, ParkingSlot } from "./types";
import type { Role } from "./jwt";
import { buildSlotsForArea, LEGACY_DEFAULT_AREA_ID, PARKING_AREA_DEFINITIONS } from "./seed";
import { hashPassword } from "./password";
import { normalizeCarNumber } from "./car-number";

let db: SqlJsDatabase | null = null;

const require = createRequire(import.meta.url);

function resolveSqlWasmDir(): string {
  try {
    const pkg = path.dirname(require.resolve("sql.js/package.json"));
    return path.join(pkg, "dist");
  } catch {
    return path.join(process.cwd(), "node_modules", "sql.js", "dist");
  }
}

/** File path or `:memory:` for tests. Default: `./data/parking.db` under cwd. */
export function resolveDbPath(): string {
  const raw = process.env.DATABASE_PATH?.trim();
  if (raw) return raw;
  return path.join(process.cwd(), "data", "parking.db");
}

function persistDb(): void {
  if (!db) return;
  const p = resolveDbPath();
  if (p === ":memory:") return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = db.export();
  fs.writeFileSync(p, Buffer.from(data));
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() from bootstrap.");
  }
  return db;
}

function tableExists(d: SqlJsDatabase, name: string): boolean {
  const stmt = d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1");
  stmt.bind([name]);
  const ok = stmt.step();
  stmt.free();
  return ok;
}

function tableHasColumn(d: SqlJsDatabase, table: string, column: string): boolean {
  const stmt = d.prepare(`PRAGMA table_info(${table})`);
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: string };
    if (row.name === column) {
      stmt.free();
      return true;
    }
  }
  stmt.free();
  return false;
}

function rowToSlot(row: Record<string, unknown>): ParkingSlot {
  return {
    areaId: String(row.area_id),
    slotId: String(row.slot_id),
    level: String(row.level),
    slotType: row.slot_type as ParkingSlot["slotType"],
    available: Boolean(row.available),
    isPaid: Boolean(row.is_paid),
    pricePerHour: Number(row.price_per_hour),
    nearLift: Boolean(row.near_lift),
  };
}

function rowToSession(row: Record<string, unknown>): ParkingSession {
  return {
    sessionId: Number(row.session_id),
    areaId: String(row.area_id),
    userId: String(row.user_id),
    carNumber: String(row.car_number),
    slotId: String(row.slot_id),
    bookingTime: String(row.booking_time),
    parkingStartTime: row.parking_start_time != null ? String(row.parking_start_time) : null,
    exitTime: row.exit_time != null ? String(row.exit_time) : null,
    estimatedFee: row.estimated_fee != null ? Number(row.estimated_fee) : null,
    paymentStatus: row.payment_status as ParkingSession["paymentStatus"],
    routeSteps: row.route_steps != null ? String(row.route_steps) : null,
    qrData: row.qr_data != null ? String(row.qr_data) : null,
  };
}

function createUsersTable(d: SqlJsDatabase): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user'))
    );
  `);
}

function createParkingAreasTable(d: SqlJsDatabase): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS parking_areas (
      area_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('mall', 'metro', 'office'))
    );
  `);
}

function seedParkingAreas(d: SqlJsDatabase): void {
  const ins = d.prepare(`
    INSERT OR IGNORE INTO parking_areas (area_id, slug, name, kind)
    VALUES (?, ?, ?, ?)
  `);
  for (const a of PARKING_AREA_DEFINITIONS) {
    ins.run([a.areaId, a.slug, a.name, a.kind]);
  }
  ins.free();
}

function createParkingSlotsV2(d: SqlJsDatabase): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS parking_slots (
      area_id TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      level TEXT NOT NULL,
      slot_type TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      is_paid INTEGER NOT NULL DEFAULT 0,
      price_per_hour INTEGER NOT NULL DEFAULT 0,
      near_lift INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (area_id, slot_id),
      FOREIGN KEY (area_id) REFERENCES parking_areas(area_id)
    );
  `);
}

function migrateParkingSlotsV1ToV2(d: SqlJsDatabase): void {
  seedParkingAreas(d);
  d.run(`
    CREATE TABLE parking_slots_migrated (
      area_id TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      level TEXT NOT NULL,
      slot_type TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      is_paid INTEGER NOT NULL DEFAULT 0,
      price_per_hour INTEGER NOT NULL DEFAULT 0,
      near_lift INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (area_id, slot_id),
      FOREIGN KEY (area_id) REFERENCES parking_areas(area_id)
    );
  `);
  d.run(
    `INSERT INTO parking_slots_migrated
      (area_id, slot_id, level, slot_type, available, is_paid, price_per_hour, near_lift)
     SELECT ?, slot_id, level, slot_type, available, is_paid, price_per_hour, near_lift
     FROM parking_slots`,
    [LEGACY_DEFAULT_AREA_ID],
  );
  d.run("DROP TABLE parking_slots");
  d.run("ALTER TABLE parking_slots_migrated RENAME TO parking_slots");
}

function ensureParkingSlotsSchema(d: SqlJsDatabase): void {
  if (!tableExists(d, "parking_slots")) {
    createParkingSlotsV2(d);
    return;
  }
  if (!tableHasColumn(d, "parking_slots", "area_id")) {
    migrateParkingSlotsV1ToV2(d);
  }
}

function createParkingSessionsV2(d: SqlJsDatabase): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS parking_sessions (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      car_number TEXT NOT NULL,
      car_number_norm TEXT NOT NULL DEFAULT '',
      slot_id TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      parking_start_time TEXT,
      exit_time TEXT,
      estimated_fee INTEGER,
      payment_status TEXT NOT NULL,
      route_steps TEXT,
      qr_data TEXT,
      FOREIGN KEY (area_id) REFERENCES parking_areas(area_id)
    );
  `);
}

function migrateParkingSessionsV1ToV2(d: SqlJsDatabase): void {
  d.run(`
    CREATE TABLE parking_sessions_migrated (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      car_number TEXT NOT NULL,
      car_number_norm TEXT NOT NULL DEFAULT '',
      slot_id TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      parking_start_time TEXT,
      exit_time TEXT,
      estimated_fee INTEGER,
      payment_status TEXT NOT NULL,
      route_steps TEXT,
      qr_data TEXT,
      FOREIGN KEY (area_id) REFERENCES parking_areas(area_id)
    );
  `);
  d.run(`
    INSERT INTO parking_sessions_migrated (
      session_id, area_id, user_id, car_number, car_number_norm, slot_id, booking_time,
      parking_start_time, exit_time, estimated_fee, payment_status, route_steps, qr_data
    )
    SELECT
      session_id, ?, user_id, car_number, UPPER(REPLACE(REPLACE(car_number, ' ', ''), '-', '')), slot_id, booking_time,
      parking_start_time, exit_time, estimated_fee, payment_status, route_steps, qr_data
    FROM parking_sessions
  `, [LEGACY_DEFAULT_AREA_ID]);
  d.run("DROP TABLE parking_sessions");
  d.run("ALTER TABLE parking_sessions_migrated RENAME TO parking_sessions");
}

function ensureParkingSessionsSchema(d: SqlJsDatabase): void {
  if (!tableExists(d, "parking_sessions")) {
    createParkingSessionsV2(d);
    return;
  }
  if (!tableHasColumn(d, "parking_sessions", "area_id")) {
    migrateParkingSessionsV1ToV2(d);
  }
  if (!tableHasColumn(d, "parking_sessions", "car_number_norm")) {
    d.run("ALTER TABLE parking_sessions ADD COLUMN car_number_norm TEXT NOT NULL DEFAULT ''");
  }
  d.run(`
    UPDATE parking_sessions
    SET car_number_norm = UPPER(REPLACE(REPLACE(car_number, ' ', ''), '-', ''))
    WHERE car_number_norm IS NULL OR car_number_norm = ''
  `);
  d.run("CREATE INDEX IF NOT EXISTS idx_sessions_car_norm_status ON parking_sessions(car_number_norm, payment_status)");
}

function createUserCarsTable(d: SqlJsDatabase): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS user_cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      car_number TEXT NOT NULL,
      car_number_norm TEXT NOT NULL,
      UNIQUE(user_id, car_number_norm)
    );
  `);
  d.run("CREATE INDEX IF NOT EXISTS idx_user_cars_user ON user_cars(user_id)");
  d.run("CREATE INDEX IF NOT EXISTS idx_user_cars_norm ON user_cars(car_number_norm)");
}

function runMigrations(d: SqlJsDatabase): void {
  createUsersTable(d);
  createParkingAreasTable(d);
  createUserCarsTable(d);
  seedParkingAreas(d);
  ensureParkingSlotsSchema(d);
  ensureParkingSessionsSchema(d);
}

/**
 * Inserts every slot from area definitions with INSERT OR IGNORE.
 */
function syncParkingSlotsFromSeed(d: SqlJsDatabase): void {
  const ins = d.prepare(`
    INSERT OR IGNORE INTO parking_slots (area_id, slot_id, level, slot_type, available, is_paid, price_per_hour, near_lift)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const def of PARKING_AREA_DEFINITIONS) {
    const rows = buildSlotsForArea(def.areaId, def.levels);
    for (const s of rows) {
      ins.run([
        s.areaId,
        s.slotId,
        s.level,
        s.slotType,
        s.available ? 1 : 0,
        s.isPaid ? 1 : 0,
        s.pricePerHour,
        s.nearLift ? 1 : 0,
      ]);
    }
  }
  ins.free();
}

function seedUsersIfEmpty(d: SqlJsDatabase): void {
  const stmt = d.prepare("SELECT COUNT(*) AS c FROM users");
  stmt.step();
  const row = stmt.getAsObject() as { c: number };
  stmt.free();
  if (row.c > 0) return;

  const ins = d.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`);
  ins.run(["admin", hashPassword("Admin#123"), "admin"]);
  ins.run(["driver", hashPassword("Driver#123"), "user"]);
  ins.free();
}

function ensureDemoUserSp(d: SqlJsDatabase): void {
  const ins = d.prepare(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`);
  ins.run(["sp", hashPassword("Sp#123"), "user"]);
  ins.free();
}

function seedUserCarsIfMissing(d: SqlJsDatabase): void {
  const ins = d.prepare(`
    INSERT OR IGNORE INTO user_cars (user_id, car_number, car_number_norm)
    VALUES (?, ?, ?)
  `);
  const seedRows = [
    { userId: "driver", carNumber: "KA05AB1234" },
    { userId: "sp", carNumber: "KA01SP0001" },
    { userId: "admin", carNumber: "KA00AD0001" },
  ];
  for (const row of seedRows) {
    ins.run([row.userId, row.carNumber, normalizeCarNumber(row.carNumber)]);
  }
  ins.free();
}

function lastInsertRowid(d: SqlJsDatabase): number {
  const st = d.prepare("SELECT last_insert_rowid() AS id");
  st.step();
  const o = st.getAsObject() as { id: number };
  st.free();
  return Number(o.id);
}

/**
 * Open SQLite (sql.js), create tables, migrate legacy single-site DBs, seed areas and slots.
 */
export async function initDatabase(): Promise<void> {
  if (db) return;

  const wasmDir = resolveSqlWasmDir();
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(wasmDir, file),
  });

  const dbPath = resolveDbPath();
  if (dbPath !== ":memory:" && fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  runMigrations(db);
  syncParkingSlotsFromSeed(db);
  seedUsersIfEmpty(db);
  ensureDemoUserSp(db);
  seedUserCarsIfMissing(db);
  persistDb();
}

export function findUserByUsername(username: string):
  | { username: string; passwordHash: string; role: Role }
  | undefined {
  const key = username.trim().toLowerCase();
  const stmt = getDb().prepare("SELECT username, password_hash, role FROM users WHERE username = ?");
  stmt.bind([key]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as { username: string; password_hash: string; role: string };
  stmt.free();
  const role = row.role;
  if (role !== "admin" && role !== "user") return undefined;
  return { username: row.username, passwordHash: row.password_hash, role };
}

export function userExists(username: string): boolean {
  return findUserByUsername(username) !== undefined;
}

export function createUser(username: string, passwordHash: string, role: Role): void {
  const key = username.trim().toLowerCase();
  const d = getDb();
  d.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [key, passwordHash, role]);
  persistDb();
}

export type UserSummaryRow = {
  username: string;
  role: Role;
  carCount: number;
};

export function listUsersWithCarCounts(): UserSummaryRow[] {
  const d = getDb();
  const stmt = d.prepare(`
    SELECT u.username, u.role, COUNT(c.id) AS car_count
    FROM users u
    LEFT JOIN user_cars c ON c.user_id = u.username
    GROUP BY u.username, u.role
    ORDER BY LOWER(u.username)
  `);
  const out: UserSummaryRow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { username: string; role: string; car_count: number };
    const role = row.role;
    if (role !== "admin" && role !== "user") continue;
    out.push({
      username: row.username,
      role,
      carCount: Number(row.car_count),
    });
  }
  stmt.free();
  return out;
}

export type ParkingAreaSummary = ParkingAreaRow & { levels: string[] };
export type UserCar = { id: number; userId: string; carNumber: string };
export type ActiveCarSession = {
  sessionId: number;
  areaId: string;
  slotId: string;
  userId: string;
  paymentStatus: ParkingSession["paymentStatus"];
};

export function getParkingAreas(): ParkingAreaSummary[] {
  const d = getDb();
  const stmt = d.prepare("SELECT area_id, slug, name, kind FROM parking_areas ORDER BY slug");
  const out: ParkingAreaSummary[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const areaId = String(row.area_id);
    const def = PARKING_AREA_DEFINITIONS.find((x) => x.areaId === areaId);
    out.push({
      areaId,
      slug: String(row.slug),
      name: String(row.name),
      kind: row.kind as ParkingAreaKind,
      levels: def?.levels ?? [],
    });
  }
  stmt.free();
  return out;
}

export function getParkingAreaByIdOrSlug(idOrSlug: string): ParkingAreaSummary | undefined {
  const key = idOrSlug.trim();
  if (!key) return undefined;
  const d = getDb();
  const stmt = d.prepare(
    "SELECT area_id, slug, name, kind FROM parking_areas WHERE area_id = ? OR slug = ? LIMIT 1",
  );
  stmt.bind([key, key]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  const areaId = String(row.area_id);
  const def = PARKING_AREA_DEFINITIONS.find((x) => x.areaId === areaId);
  return {
    areaId,
    slug: String(row.slug),
    name: String(row.name),
    kind: row.kind as ParkingAreaKind,
    levels: def?.levels ?? [],
  };
}

export function getAllSlotsForArea(areaId: string): ParkingSlot[] {
  const d = getDb();
  const stmt = d.prepare(
    "SELECT * FROM parking_slots WHERE area_id = ? ORDER BY level, slot_id",
  );
  stmt.bind([areaId]);
  const out: ParkingSlot[] = [];
  while (stmt.step()) {
    out.push(rowToSlot(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return out;
}

export function getSlotByAreaAndId(areaId: string, slotId: string): ParkingSlot | undefined {
  const stmt = getDb().prepare("SELECT * FROM parking_slots WHERE area_id = ? AND slot_id = ?");
  stmt.bind([areaId, slotId]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return rowToSlot(row);
}

export function setSlotAvailableForArea(areaId: string, slotId: string, available: boolean): void {
  const d = getDb();
  d.run("UPDATE parking_slots SET available = ? WHERE area_id = ? AND slot_id = ?", [
    available ? 1 : 0,
    areaId,
    slotId,
  ]);
  persistDb();
}

export function getAllSessionsForArea(areaId: string): ParkingSession[] {
  const d = getDb();
  const stmt = d.prepare("SELECT * FROM parking_sessions WHERE area_id = ? ORDER BY session_id");
  stmt.bind([areaId]);
  const out: ParkingSession[] = [];
  while (stmt.step()) {
    out.push(rowToSession(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return out;
}

/** All sessions for an account across every parking site (newest first). */
export function getAllSessionsForUser(userId: string): ParkingSession[] {
  const d = getDb();
  const stmt = d.prepare(
    "SELECT * FROM parking_sessions WHERE user_id = ? ORDER BY booking_time DESC, session_id DESC",
  );
  stmt.bind([userId]);
  const out: ParkingSession[] = [];
  while (stmt.step()) {
    out.push(rowToSession(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return out;
}

export function findSessionByIdInArea(sessionId: number, areaId: string): ParkingSession | undefined {
  const stmt = getDb().prepare(
    "SELECT * FROM parking_sessions WHERE session_id = ? AND area_id = ?",
  );
  stmt.bind([sessionId, areaId]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return rowToSession(row);
}

export function insertSession(data: Omit<ParkingSession, "sessionId">): ParkingSession {
  const d = getDb();
  const norm = normalizeCarNumber(data.carNumber);
  d.run(
    `INSERT INTO parking_sessions (
      area_id, user_id, car_number, car_number_norm, slot_id, booking_time, parking_start_time, exit_time, estimated_fee, payment_status, route_steps, qr_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.areaId,
      data.userId,
      data.carNumber,
      norm,
      data.slotId,
      data.bookingTime,
      data.parkingStartTime,
      data.exitTime,
      data.estimatedFee,
      data.paymentStatus,
      data.routeSteps,
      data.qrData,
    ],
  );
  const id = lastInsertRowid(d);
  persistDb();
  return findSessionByIdInArea(id, data.areaId)!;
}

export function updateSessionFull(session: ParkingSession): void {
  const d = getDb();
  const norm = normalizeCarNumber(session.carNumber);
  d.run(
    `UPDATE parking_sessions SET
      area_id = ?,
      user_id = ?,
      car_number = ?,
      car_number_norm = ?,
      slot_id = ?,
      booking_time = ?,
      parking_start_time = ?,
      exit_time = ?,
      estimated_fee = ?,
      payment_status = ?,
      route_steps = ?,
      qr_data = ?
    WHERE session_id = ? AND area_id = ?`,
    [
      session.areaId,
      session.userId,
      session.carNumber,
      norm,
      session.slotId,
      session.bookingTime,
      session.parkingStartTime,
      session.exitTime,
      session.estimatedFee,
      session.paymentStatus,
      session.routeSteps,
      session.qrData,
      session.sessionId,
      session.areaId,
    ],
  );
  persistDb();
}

export function getUserCars(userId: string): UserCar[] {
  const d = getDb();
  const stmt = d.prepare("SELECT id, user_id, car_number FROM user_cars WHERE user_id = ? ORDER BY id DESC");
  stmt.bind([userId]);
  const out: UserCar[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    out.push({
      id: Number(row.id),
      userId: String(row.user_id),
      carNumber: String(row.car_number),
    });
  }
  stmt.free();
  return out;
}

export function addUserCar(userId: string, carNumber: string): UserCar {
  const d = getDb();
  const normalized = normalizeCarNumber(carNumber);
  if (!normalized) {
    throw new Error("Invalid car number");
  }
  d.run(
    "INSERT OR IGNORE INTO user_cars (user_id, car_number, car_number_norm) VALUES (?, ?, ?)",
    [userId, carNumber.trim().toUpperCase(), normalized],
  );
  persistDb();
  const stmt = d.prepare(
    "SELECT id, user_id, car_number FROM user_cars WHERE user_id = ? AND car_number_norm = ? LIMIT 1",
  );
  stmt.bind([userId, normalized]);
  stmt.step();
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    carNumber: String(row.car_number),
  };
}

export function removeUserCar(userId: string, carNumber: string): number {
  const normalized = normalizeCarNumber(carNumber);
  if (!normalized) return 0;
  const d = getDb();
  d.run("DELETE FROM user_cars WHERE user_id = ? AND car_number_norm = ?", [userId, normalized]);
  const st = d.prepare("SELECT changes() AS c");
  st.step();
  const row = st.getAsObject() as { c: number };
  st.free();
  persistDb();
  return Number(row.c);
}

export function isCarOwnedByUser(userId: string, carNumber: string): boolean {
  const normalized = normalizeCarNumber(carNumber);
  if (!normalized) return false;
  const stmt = getDb().prepare(
    "SELECT 1 FROM user_cars WHERE user_id = ? AND car_number_norm = ? LIMIT 1",
  );
  stmt.bind([userId, normalized]);
  const ok = stmt.step();
  stmt.free();
  return ok;
}

export function findActiveSessionByCarNumber(carNumber: string): ActiveCarSession | undefined {
  const normalized = normalizeCarNumber(carNumber);
  if (!normalized) return undefined;
  const stmt = getDb().prepare(`
    SELECT session_id, area_id, slot_id, user_id, payment_status
    FROM parking_sessions
    WHERE car_number_norm = ?
      AND payment_status IN ('pending', 'parked')
    ORDER BY session_id DESC
    LIMIT 1
  `);
  stmt.bind([normalized]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return {
    sessionId: Number(row.session_id),
    areaId: String(row.area_id),
    slotId: String(row.slot_id),
    userId: String(row.user_id),
    paymentStatus: row.payment_status as ParkingSession["paymentStatus"],
  };
}
