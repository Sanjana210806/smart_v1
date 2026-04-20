import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import meCarsRouter from "./me-cars";
import meBookingsRouter from "./me-bookings";
import adminUsersRouter from "./admin-users";
import areasRouter from "./areas";
import areaScopeRouter from "./area-scope";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(meCarsRouter);
router.use(meBookingsRouter);
router.use(adminUsersRouter);
router.use(areasRouter);
router.use("/areas/:areaId", areaScopeRouter);

export default router;
