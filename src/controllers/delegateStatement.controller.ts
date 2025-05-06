import { Request, Response } from "express";
import { prisma } from "../index";

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
      res.status(200).json({ delegateStatement });
    } catch (error) {
      console.error("Error fetching delegate statement:", error);
      res.status(500).json({ error: "Failed to fetch delegate statement" });
    }
  };
}
