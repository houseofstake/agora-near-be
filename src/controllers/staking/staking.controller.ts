import { Request, Response } from "express";
import { providers } from "near-api-js";
import { prisma } from "../..";
import { fetchPriceAtBlock } from "../../lib/staking/fetchPriceAtBlock";
import { getRpcUrl } from "../../lib/utils/rpc";

const CONTRACTS_TO_PRICE_METHOD: Record<string, string> = {
  "linear-protocol.near": "ft_price",
  "linear-protocol.testnet": "ft_price",
  "meta-v2.pool.testnet": "get_st_near_price",
  "meta-pool.near": "get_st_near_price",
};

const DAYS_AGO = 25;

export class StakingController {
  public getAPY = async (
    req: Request<{}, {}, {}, { networkId: string; contractId: string }>,
    res: Response
  ): Promise<any> => {
    try {
      const { networkId, contractId } = req.query;
      const rpcUrl = getRpcUrl({ networkId, useArchivalNode: true });
      const provider = new providers.JsonRpcProvider({ url: rpcUrl });

      const methodName = CONTRACTS_TO_PRICE_METHOD[contractId] ?? "ft_price";

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - DAYS_AGO);

      const blockTargetDatePromise = prisma.blocks.findFirst({
        select: {
          height: true,
        },
        where: {
          timestamp: {
            lte: targetDate.toISOString(),
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
      });

      const priceNowPromise = fetchPriceAtBlock(
        provider,
        contractId,
        methodName
      );

      const [blockTargetDate, priceNow] = await Promise.all([
        blockTargetDatePromise,
        priceNowPromise,
      ]);

      const blockHeight = Number(blockTargetDate?.height);

      const priceThen = await fetchPriceAtBlock(
        provider,
        contractId,
        methodName,
        blockHeight
      );

      const rate = priceNow / priceThen - 1;
      const apy = Math.pow(1 + rate, 365 / DAYS_AGO) - 1;

      res.status(200).json({ apy });
    } catch (error) {
      res.status(500).json({ error: `RPC call failed: ${error}` });
    }
  };
}
