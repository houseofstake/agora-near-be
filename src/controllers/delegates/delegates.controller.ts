import { Request, Response } from "express";
import { prisma } from "../../index";
import { verifySignature } from "../../lib/signature/verifySignature";
import { sanitizeContent } from "../../lib/utils/sanitizationUtils";

type DelegateStatementInput = {
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

export class DelegatesController {
  public getDelegateByAddress = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const delegateStatement = await prisma.delegate_statements.findUnique({
        where: { address },
      });

      if (!delegateStatement) {
        // For now, just return the address if not found since
        // we don't actually have a table for registered voters/delegates yet.
        // Eventually, this will return a 404.
        res.status(200).json({
          delegate: {
            address,
          },
        });
        return;
      }

      const {
        twitter,
        discord,
        email,
        warpcast,
        statement,
        topIssues,
        address: delegateAddress,
      } = delegateStatement;

      res.status(200).json({
        delegate: {
          address: delegateAddress,
          twitter,
          discord,
          email,
          warpcast,
          statement,
          topIssues,
        },
      });
    } catch (error) {
      console.error("Error fetching delegate:", error);
      res.status(500).json({ error: "Failed to fetch delegate" });
    }
  };

  public createDelegateStatement = async (
    req: Request<{}, {}, DelegateStatementInput>,
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
        publicKey,
      };

      const createdDelegateStatement = await prisma.delegate_statements.upsert({
        where: { address },
        update: data,
        create: data,
      });

      res
        .status(200)
        .json({ delegateStatement: createdDelegateStatement, success: true });
    } catch (error) {
      console.error("Error creating delegate statement:", error);
      res.status(500).json({ error: "Failed to create delegate statement" });
    }
  };
}
