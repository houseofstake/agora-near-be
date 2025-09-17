import axios from "axios";
import { Request, Response } from "express";
import { NEAR_BLOCKS_BASE_URL } from "../../lib/nearBlocks";
import { prisma } from "../..";

export class TransactionsController {
  public getTransactionHash = async (
    req: Request<{}, {}, {}, { network_id: string; receipt_id: string }>,
    res: Response
  ) => {
    const { network_id, receipt_id } = req.query;

    if (network_id !== "testnet" && network_id !== "mainnet") {
      res.status(400).json({ error: "Invalid network ID" });
      return;
    }

    if (!receipt_id) {
      res.status(400).json({ error: "Receipt ID is required" });
      return;
    }

    try {
      const cacheKey = `transaction-hash-${network_id}-${receipt_id}`;

      const cachedEntry = await prisma.cache.findFirst({
        where: {
          key: cacheKey,
        },
      });

      if (cachedEntry) {
        res.status(200).json(cachedEntry.data);
        return;
      }

      const response = await axios.get<{
        receipts: {
          receipt_id: string;
          originated_from_transaction_hash: string;
        }[];
      }>(
        `${NEAR_BLOCKS_BASE_URL[network_id]}/search/receipts?keyword=${receipt_id}`
      );

      const transactionHash =
        response.data.receipts.at(0)?.originated_from_transaction_hash;

      if (!transactionHash) {
        res.status(404).json({
          error: "No transaction hash found for receipt",
        });
        return;
      }

      const transactionHashResponse = {
        transactionHash,
      };

      await prisma.cache.upsert({
        where: { key: cacheKey },
        update: {
          data: transactionHashResponse,
        },
        create: {
          key: cacheKey,
          data: transactionHashResponse,
          expiresAt: new Date(),
        },
      });

      res.status(200).json(transactionHashResponse);
    } catch (e) {
      res.status(500).json({ error: "Failed to get transaction hash" });
      return;
    }
  };
}
