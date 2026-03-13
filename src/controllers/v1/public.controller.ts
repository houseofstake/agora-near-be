import { Response } from "express";
import { ApiKeyRequest } from "../../middleware/apiKeyAuth";
import { prisma } from "../../index";
import { ProposalController } from "../proposal/proposals.controller";
import { DelegatesController } from "../delegates/delegates.controller";

const proposalController = new ProposalController();
const delegatesController = new DelegatesController();

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

export const getProposals = async (req: ApiKeyRequest, res: Response) => {
  try {
    // Agents with 'read:forum' (or similar read scopes) can view proposals
    return await proposalController.getApprovedProposals(req, res);
  } catch (error) {
    console.error("Error fetching proposals for agent:", error);
    return res.status(500).json({ error: "Failed to fetch proposals" });
  }
}

export const getDelegates = async (req: ApiKeyRequest, res: Response) => {
  try {
    // Agents with 'read:forum' can view the delegate list
    return await delegatesController.getAllDelegates(req, res);
  } catch (error) {
    console.error("Error fetching delegates for agent:", error);
    return res.status(500).json({ error: "Failed to fetch delegates" });
  }
}

export const castProxyVote = async (req: ApiKeyRequest, res: Response) => {
  try {
    const accountId = req.user?.accountId;
    const { proposalId, voteAction } = req.body;

    if (!proposalId || !voteAction) {
      return res.status(400).json({ error: "Missing proposalId or voteAction" });
    }

    // TODO: This is where we would securely dispatch the vote transaction 
    // to the blockchain via a relayer or sign it conceptually if we hold keys.
    // For now, it returns the intent securely authenticated.
    return res.status(201).json({
      message: `Vote intent securely received on behalf of ${accountId}`,
      receipt: {
        proposalId,
        action: voteAction,
        timestamp: new Date().toISOString(),
        status: "pending_on_chain"
      }
    });

  } catch (error) {
    console.error("Error casting proxy vote:", error);
    return res.status(500).json({ error: "Failed to cast proxy vote" });
  }
}
