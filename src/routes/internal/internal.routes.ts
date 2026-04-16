import express from "express";
import { WatchdogController } from "../../controllers/internal/watchdog.controller";
import { NotificationsInternalController } from "../../controllers/internal/notifications-internal.controller";
import { CronController } from "../../controllers/internal/cron.controller";

const router = express.Router();
const watchdogController = new WatchdogController();
const notificationsInternalController = new NotificationsInternalController();
const cronController = new CronController();

router.get("/watchdog/voting-power", watchdogController.runVotingPowerAudit);

router.get(
  "/notifications/delegate-emails",
  notificationsInternalController.getDelegateEmailsByPreference,
);

router.get("/cron/sync-social", cronController.syncSocialProfiles.bind(cronController));


export { router as internalRoutes };
