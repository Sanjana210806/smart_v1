import { Router, type IRouter } from "express";
import { healthCheckResponseSchema } from "../lib/schemas";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = healthCheckResponseSchema.parse({ status: "ok" });
  res.json(data);
});

export default router;
