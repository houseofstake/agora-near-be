import { Request, Response } from "express";
import { prisma } from "../../index";

export class NearController {
  public getNearPrice = async (req: Request, res: Response): Promise<void> => {
    try {
      const cacheKey = "near-usd-price";
      const cacheTTL = 30 * 60 * 1000; // Cache for 30 minutes

      // Check database cache first
      const cachedEntry = await prisma.cache.findFirst({
        where: {
          key: cacheKey,
          expiresAt: {
            gt: new Date(), // Only get entries that haven't expired
          },
        },
      });

      if (cachedEntry) {
        res.status(200).json(cachedEntry.data);
        return;
      }

      // Get API key from environment
      const apiKey = process.env.COIN_GECKO_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Failed to fetch NEAR price" });
        return;
      }

      // Call CoinGecko API
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/near",
        {
          method: "GET",
          headers: {
            "x-cg-demo-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        res.status(response.status).json({
          error: `Failed to fetch NEAR price`,
        });
        return;
      }

      const data = await response.json();

      // Extract the USD price
      const usdPrice = data?.market_data?.current_price?.usd;
      if (typeof usdPrice !== "number") {
        res.status(500).json({ error: "Failed to fetch NEAR price" });
        return;
      }

      const priceResponse = {
        price: usdPrice,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      };

      // Cache the response in database with TTL
      const expiresAt = new Date(Date.now() + cacheTTL);

      await prisma.cache.upsert({
        where: { key: cacheKey },
        update: {
          data: priceResponse,
          expiresAt: expiresAt,
        },
        create: {
          key: cacheKey,
          data: priceResponse,
          expiresAt: expiresAt,
        },
      });

      res.status(200).json(priceResponse);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch NEAR price",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  public cleanupExpiredCache = async (): Promise<void> => {
    try {
      await prisma.cache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(), // Delete entries that have expired
          },
        },
      });
    } catch (error) {
      console.error("Error cleaning up expired cache entries:", error);
    }
  };
}
