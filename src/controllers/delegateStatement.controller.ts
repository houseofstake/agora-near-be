import { Request, Response } from "express";
import { prisma } from "../index";
import { sanitizeContent } from "../lib/utils/sanitizationUtils";
import { InputJsonValue } from "@prisma/client/runtime/library";

type DelegateStatement = {
  agreeCodeConduct: boolean;
  discord: string;
  delegateStatement: string;
  email: string;
  twitter: string;
  warpcast: string;
  topIssues: {
    type: string;
    value: string;
  }[];
};

type DelegateStatementsCreateInput = {
  address: string;
  delegateStatement: DelegateStatement;
  signature: string;
  publicKey: string;
  twitter: string;
  discord: string;
  email: string;
  warpcast: string;
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
        delegateStatement,
        publicKey,
        twitter,
        discord,
        email,
        warpcast,
      } = req.body;

      // TODO: Check validity of signature

      const sanitizedStatement = {
        ...delegateStatement,
        delegateStatement: sanitizeContent(delegateStatement.delegateStatement),
      };

      const data = {
        address,
        signature,
        payload: sanitizedStatement as InputJsonValue,
        twitter,
        warpcast,
        discord,
        email,
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
