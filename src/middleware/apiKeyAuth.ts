import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../index";

const hashApiKey = (key: string) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};

// Extends Express Request to include the authenticated user
export interface ApiKeyRequest extends Request {
  user?: {
    accountId: string;
    keyId: string;
    scopes: string[];
  };
}

export const apiKeyAuth = (requiredScopes: string[] = []) => {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      // 1. Extract API Key from Header
      const apiKey = req.headers["x-api-key"];

      if (!apiKey || typeof apiKey !== "string") {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Missing or invalid x-api-key header",
        });
      }

      // 2. Hash the provided key to look it up securely
      const keyHash = hashApiKey(apiKey);

      // 3. Find the key in the database
      const keyRecord = await prisma.api_keys.findFirst({
        where: {
          keyHash,
        },
      });

      if (!keyRecord) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid API Key",
        });
      }

      // 4. Validate Scopes
      // If the route requires specific scopes, check if the key has them (or has 'full' access)
      if (requiredScopes.length > 0) {
        const hasFullAccess = keyRecord.scopes.includes("full") || keyRecord.scopes.includes("full_access");
        const hasRequiredScope = requiredScopes.some((scope) =>
          keyRecord.scopes.includes(scope)
        );

        if (!hasFullAccess && !hasRequiredScope) {
          return res.status(403).json({
            error: "Forbidden",
            message: "API Key lacks required scopes for this action",
          });
        }
      }

      // 5. Analytics Logging Placeholder (Mixpanel/Winston)
      // This is fired asynchronously so it doesn't block the request
      /* 
      logAnalyticsEvent({
        event: "api_key_used",
        accountId: keyRecord.accountId,
        endpoint: req.originalUrl,
        keyHint: keyRecord.keyHint
      });
      */

      // 6. Attach the accountId to the request context for the controllers to consume
      req.user = {
        accountId: keyRecord.accountId,
        keyId: keyRecord.id,
        scopes: keyRecord.scopes,
      };

      next();
    } catch (error) {
      console.error("API Key Auth Error:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to authenticate API API",
      });
    }
  };
};
