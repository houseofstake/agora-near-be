import { Router, RequestHandler } from "express";
import { apiKeyAuth } from "../../middleware/apiKeyAuth";
import { getAgentProfile, getProposals, getDelegates, getAPY, getVeNearSupply } from "../../controllers/v1/public.controller";

const router = Router();

// /v1/me -> Returns profile info. Requires no special scopes, just a valid key.
router.get("/me", apiKeyAuth() as unknown as RequestHandler, getAgentProfile as unknown as RequestHandler);

// /v1/proposals
router.get("/proposals", apiKeyAuth() as unknown as RequestHandler, getProposals as unknown as RequestHandler);

// /v1/delegates
router.get("/delegates", apiKeyAuth() as unknown as RequestHandler, getDelegates as unknown as RequestHandler);

// /v1/staking/apy
router.get("/staking/apy", apiKeyAuth() as unknown as RequestHandler, getAPY as unknown as RequestHandler);

// /v1/venear/supply
router.get("/venear/supply", apiKeyAuth() as unknown as RequestHandler, getVeNearSupply as unknown as RequestHandler);

export default router;
