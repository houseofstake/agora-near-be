import express from "express";
import { WatchdogController } from "../../controllers/internal/watchdog.controller";
import { NotificationsInternalController } from "../../controllers/internal/notifications-internal.controller";

const router = express.Router();
const watchdogController = new WatchdogController();
const notificationsInternalController = new NotificationsInternalController();

router.get("/watchdog/voting-power", watchdogController.runVotingPowerAudit);

router.get(
  "/notifications/delegate-emails",
  notificationsInternalController.getDelegateEmailsByPreference,
);

export { router as internalRoutes };
