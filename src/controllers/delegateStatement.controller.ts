import { Request, Response } from "express";
import { prisma } from "../index";
import { verifySignature } from "../lib/signature/verifySignature";
import { sanitizeContent } from "../lib/utils/sanitizationUtils";

type DelegateStatementsCreateInput = {
  address: string;
  message: string;
  signature: string;
  publicKey: string;
  twitter: string;
  discord: string;
  email: string;
  warpcast: string;
  topIssues: {
    type: string;
    value: string;
  }[];
  agreeCodeConduct: boolean;
  statement: string;
};

export class DelegateStatementController {
  public getDelegateStatementByAddress = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const delegateStatement = await prisma.delegateStatements.findUnique({
        where: { address },
      });

      if (!delegateStatement) {
        res.status(404).json({ error: "Delegate statement not found" });
        return;
      }

      res.status(200).json({ delegateStatement });
    } catch (error) {
      console.error("Error fetching delegate statement:", error);
      res.status(500).json({ error: "Failed to fetch delegate statement" });
    }
  };

  public createDelegateStatement = async (
    req: Request<{}, {}, DelegateStatementsCreateInput>,
    res: Response
  ): Promise<void> => {
    try {
      const {
        address,
        signature,
        publicKey,
        twitter,
        discord,
        email,
        warpcast,
        message,
        statement,
        topIssues,
        agreeCodeConduct,
      } = req.body;

      const isVerified = verifySignature({
        message,
        signature,
        publicKey,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const data = {
        address,
        message,
        signature,
        statement: sanitizeContent(statement),
        twitter,
        warpcast,
        discord,
        email,
        topIssues,
        agreeCodeConduct,
      };

      const createdDelegateStatement = await prisma.delegateStatements.upsert({
        where: { address },
        update: data,
        create: data,
      });

      res.status(200).json({ delegateStatement: createdDelegateStatement });
    } catch (error) {
      console.error("Error creating delegate statement:", error);
      res.status(500).json({ error: "Failed to create delegate statement" });
    }
  };
}
