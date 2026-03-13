import { Router, RequestHandler } from "express";
import { apiKeyAuth } from "../../middleware/apiKeyAuth";
import { getAgentProfile, getForumData, castProxyVote } from "../../controllers/v1/public.controller";

const router = Router();

// /v1/me -> Returns profile info. Requires no special scopes, just a valid key.
router.get("/me", apiKeyAuth() as unknown as RequestHandler, getAgentProfile as unknown as RequestHandler);

// /v1/forum-data -> Requires 'read:forum' scope
router.get("/forum-data", apiKeyAuth(["read:forum"]) as unknown as RequestHandler, getForumData as unknown as RequestHandler);

// /v1/vote -> Requires 'write:vote' scope
router.post("/vote", apiKeyAuth(["write:vote"]) as unknown as RequestHandler, castProxyVote as unknown as RequestHandler);

export default router;
