import express from "express";
import { ProposalVotingHistoryController } from "../controllers/proposalVotingHistory.controller";

const router = express.Router();
const proposalVotingHistoryController = new ProposalVotingHistoryController();

router.get(
  "/:proposal_id",
  proposalVotingHistoryController.getProposalVotingHistory
);

export default router;
