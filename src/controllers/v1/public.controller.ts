import { Response } from "express";
import { ApiKeyRequest } from "../../middleware/apiKeyAuth";
import { prisma } from "../../index";
import { ProposalController } from "../proposal/proposals.controller";
import { DelegatesController } from "../delegates/delegates.controller";
import { StakingController } from "../staking/staking.controller";
import { VenearController } from "../venear/venear.controller";

const proposalController = new ProposalController();
const delegatesController = new DelegatesController();
const stakingController = new StakingController();
const venearController = new VenearController();

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

export const getAPY = async (
  req: ApiKeyRequest & import("express").Request<{}, {}, {}, { networkId: string; contractId: string }>,
  res: Response
) => {
  try {
    return await stakingController.getAPY(req, res);
  } catch (error) {
    console.error("Error fetching APY for agent:", error);
    return res.status(500).json({ error: "Failed to fetch APY" });
  }
};

export const getVeNearSupply = async (req: ApiKeyRequest, res: Response) => {
  try {
    return await venearController.getTotalSupplyHistory(req, res);
  } catch (error) {
    console.error("Error fetching veNEAR supply for agent:", error);
    return res.status(500).json({ error: "Failed to fetch veNEAR supply" });
  }
}
