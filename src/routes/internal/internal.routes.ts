import express from "express";
import { WatchdogController } from "../../controllers/internal/watchdog.controller";

const router = express.Router();
const watchdogController = new WatchdogController();

router.get("/watchdog/voting-power", watchdogController.runVotingPowerAudit);

export { router as internalRoutes };
