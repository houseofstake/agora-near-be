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
      const apiKey = req.headers["x-api-key"];

      if (!apiKey || typeof apiKey !== "string") {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Missing or invalid x-api-key header",
        });
      }

      const keyHash = hashApiKey(apiKey);

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

      /* Analytics Logging Placeholder (Mixpanel/Winston) - Fired asynchronously
      logAnalyticsEvent({
        event: "api_key_used",
        accountId: keyRecord.accountId,
        endpoint: req.originalUrl,
        keyHint: keyRecord.keyHint
      });
      */

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
