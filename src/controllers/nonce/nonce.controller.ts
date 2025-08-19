import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { prisma } from "../..";

export class NonceController {
  public generateNonce = async (
    req: Request<{}, {}, {}, { account_id: string }>,
    res: Response
  ): Promise<void> => {
    try {
      const accountId = req.query.account_id;

      if (!accountId) {
        res.status(400).json({ error: "Account ID is required" });
        return;
      }

      const cacheKey = `nonce-${accountId}`;
      const cacheTTL = 60 * 1000; // Cache for 1 minute

      const nonce = randomBytes(32);

      const nonceResponse = {
        nonce: nonce.toString("hex"),
      };

      const expiresAt = new Date(Date.now() + cacheTTL);

      await prisma.cache.upsert({
        where: { key: cacheKey },
        update: {
          data: nonceResponse,
          expiresAt: expiresAt,
        },
        create: {
          key: cacheKey,
          data: nonceResponse,
          expiresAt: expiresAt,
        },
      });

      res.status(200).json(nonceResponse);
    } catch (error) {
      res.status(500).json({
        error: "Failed to generate nonce",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
