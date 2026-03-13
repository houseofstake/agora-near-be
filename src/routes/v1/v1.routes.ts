import { Router, RequestHandler } from "express";
import { apiKeyAuth } from "../../middleware/apiKeyAuth";
import { getAgentProfile, getProposals, getDelegates, castProxyVote } from "../../controllers/v1/public.controller";

const router = Router();

// /v1/me -> Returns profile info. Requires no special scopes, just a valid key.
router.get("/me", apiKeyAuth() as unknown as RequestHandler, getAgentProfile as unknown as RequestHandler);

// /v1/proposals -> Requires 'read:data' scope
router.get("/proposals", apiKeyAuth(["read:data"]) as unknown as RequestHandler, getProposals as unknown as RequestHandler);

// /v1/delegates -> Requires 'read:data' scope
router.get("/delegates", apiKeyAuth(["read:data"]) as unknown as RequestHandler, getDelegates as unknown as RequestHandler);

// /v1/vote -> Requires 'write:vote' scope
router.post("/vote", apiKeyAuth(["write:vote"]) as unknown as RequestHandler, castProxyVote as unknown as RequestHandler);

export default router;
