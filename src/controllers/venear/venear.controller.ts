import { Request, Response } from "express";
import { prisma } from "../..";

const RANGE_DAYS: Record<string, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

export class VenearController {
  public getTotalSupplyHistory = async (
    req: Request<{}, {}, {}, { range?: string }>,
    res: Response,
  ): Promise<any> => {
    try {
      const range = (req.query.range ?? "1Y").toUpperCase();
      const days = RANGE_DAYS[range] ?? RANGE_DAYS["1Y"];
      const from = new Date();
      from.setDate(from.getDate() - days);

      const [history, participantsCount] = await Promise.all([
        prisma.venear_total_supply_history.findMany({
          where: { recordedAt: { gte: from } },
          orderBy: { recordedAt: "asc" },
          select: {
            recordedAt: true,
            totalSupply: true,
          },
        }),
        prisma.registeredVoters.count(),
      ]);

      const latest = history.length > 0 ? history[history.length - 1] : null;

      res.status(200).json({
        data: history.map((h) => ({
          recorded_at: h.recordedAt.toISOString(),
          total_supply: h.totalSupply,
        })),
        latest: latest ? latest.totalSupply : null,
        participants_count: participantsCount,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: `Failed to fetch venear supply history: ${error}` });
    }
  };
}
