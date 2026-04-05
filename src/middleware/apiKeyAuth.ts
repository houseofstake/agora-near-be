import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { mixpanel } from "../utils/mixpanel";

// Extends Express Request to include the authenticated user
export interface ApiKeyRequest extends Request {
  user?: {
    accountId: string;
    keyId: string;
  };
}

export const apiKeyAuth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers["x-api-key"];

      if (!apiKey || typeof apiKey !== "string") {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Missing or invalid x-api-key header",
        });
      }

      const keyRecord = await prisma.api_keys.findFirst({
        where: {
          key: apiKey,
        },
      });

      if (!keyRecord) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid API Key",
        });
      }

      // Analytics Logging - Fired asynchronously, non-blocking
      mixpanel.track("API_Key_Used", {
        distinct_id: keyRecord.accountId,
        endpoint: req.originalUrl,
      });

      (req as ApiKeyRequest).user = {
        accountId: keyRecord.accountId,
        keyId: keyRecord.id,
      };

      next();
    } catch (error) {
      console.error("API Key Auth Error:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to authenticate API",
      });
    }
  };
};
