import { Request, Response } from "express";
import { providers } from "near-api-js";
import { fetchPriceAtBlock } from "../../lib/staking/fetchPriceAtBlock";
import { getRpcUrl } from "../../lib/utils/rpc";
import { prisma } from "../..";

const META_POOL_CONTRACTS = ["meta-v2.pool.testnet", "meta-pool.near"];

export class StakingController {
  public getAPY = async (
    req: Request<{}, {}, {}, { networkId: string; contractId: string }>,
    res: Response
  ): Promise<any> => {
    try {
      const { networkId, contractId } = req.query;
      const rpcUrl = getRpcUrl({ networkId, useArchivalNode: true });
      const provider = new providers.JsonRpcProvider({ url: rpcUrl });
      const isMetaPoolContract = META_POOL_CONTRACTS.includes(contractId);
      const methodName = isMetaPoolContract ? "get_st_near_price" : "ft_price";
      // MetaPool uses 365 days of price history to calculate APY, liNEAR uses 30 day price history
      const numDaysAgo = isMetaPoolContract ? 365 : 25;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - numDaysAgo);

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

      // Only annualize for liNEAR, MetaPool rate is already annualized
      const apy = isMetaPoolContract
        ? rate
        : Math.pow(1 + rate, 365 / numDaysAgo) - 1;

      res.status(200).json({ apy });
    } catch (error) {
      res.status(500).json({ error: `RPC call failed: ${error}` });
    }
  };
}
