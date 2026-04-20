import { Router, type IRouter } from "express";
import { attachParkingArea } from "../middleware/parking-area";
import slotsRouter from "./slots";
import recommendationRouter from "./recommendation";
import sessionsRouter from "./sessions";
import dashboardRouter from "./dashboard";

/**
 * All routes under `/api/areas/:areaId/...` share `req.parkingArea` after `attachParkingArea`.
 * `:areaId` may be the stable `areaId` or a `slug` (e.g. `city-mall`).
 */
const areaScope: IRouter = Router({ mergeParams: true });
areaScope.use(attachParkingArea);
areaScope.use(slotsRouter);
areaScope.use(recommendationRouter);
areaScope.use(sessionsRouter);
areaScope.use(dashboardRouter);

export default areaScope;
