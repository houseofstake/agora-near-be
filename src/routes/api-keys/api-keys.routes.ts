import { Router, RequestHandler } from "express";
import { generateApiKey, getApiKeys, revokeApiKey, updateApiKeyScopes } from "../../controllers/api-keys/api-keys.controller";

const router = Router();

router.post("/list", getApiKeys as unknown as RequestHandler);
router.post("/", generateApiKey as unknown as RequestHandler);
router.post("/:id/revoke", revokeApiKey as unknown as RequestHandler);
router.patch("/:id", updateApiKeyScopes as unknown as RequestHandler);

export default router;
