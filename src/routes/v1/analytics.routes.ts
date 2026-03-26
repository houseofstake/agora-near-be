import { Router, RequestHandler } from "express";
import { AnalyticsController } from "../../controllers/v1/analytics.controller";

const router = Router();
const analyticsController = new AnalyticsController();

// Global Ecosystem Metrics
router.get(
  "/global",
  analyticsController.getGlobalAnalytics.bind(analyticsController) as unknown as RequestHandler,
);

// Proposal Specific Breakdown
router.get(
  "/proposal/:proposalId",
  analyticsController.getProposalAnalytics.bind(analyticsController) as unknown as RequestHandler,
);

export default router;
