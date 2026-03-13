import { Response } from "express";
import { ApiKeyRequest } from "../../middleware/apiKeyAuth";
import { prisma } from "../../index";

export const getAgentProfile = async (req: ApiKeyRequest, res: Response) => {
  try {
    const accountId = req.user?.accountId;

    if (!accountId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch basic delegate profile info from Agora's DB
    const profile = await prisma.delegate_statements.findUnique({
      where: {
        address: accountId,
      },
      select: {
        address: true,
        twitter: true,
        discord: true,
        email: true,
        warpcast: true,
        topIssues: true,
      },
    });

    return res.status(200).json({
      message: "API Key Authenticated",
      apiKeyDetails: {
        scopes: req.user?.scopes,
        keyId: req.user?.keyId,
      },
      profile: profile || { account_id: accountId, note: "No public profile found." },
    });
  } catch (error) {
    console.error("Error fetching agent profile:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const getForumData = async (req: ApiKeyRequest, res: Response) => {
  try {
    const accountId = req.user?.accountId;

    return res.status(200).json({
      message: `Fetching forum activity for ${accountId}`,
      forumData: [
        { id: 1, topic: "NEAR Protocol Updates", replies: 5 },
        { id: 2, topic: "HoS Agentic AI Governance", replies: 12 },
      ]
    });
  } catch (error) {
    console.error("Error fetching forum data:", error);
    return res.status(500).json({ error: "Failed to fetch forum data" });
  }
}

export const castProxyVote = async (req: ApiKeyRequest, res: Response) => {
  try {
    const accountId = req.user?.accountId;
    const { proposalId, voteAction } = req.body;

    if (!proposalId || !voteAction) {
      return res.status(400).json({ error: "Missing proposalId or voteAction" });
    }

    return res.status(201).json({
      message: `Successfully cast proxy vote acting as ${accountId}`,
      receipt: {
        proposalId,
        action: voteAction,
        timestamp: new Date().toISOString(),
        castByAgent: true
      }
    });

  } catch (error) {
    console.error("Error casting proxy vote:", error);
    return res.status(500).json({ error: "Failed to cast proxy vote" });
  }
}
