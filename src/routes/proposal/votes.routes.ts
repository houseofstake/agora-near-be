import express from "express";
import { ProposalVotingHistoryController } from "../../controllers/proposal/votes/votes.controller";

const router = express.Router();
const proposalVotingHistoryController = new ProposalVotingHistoryController();

router.get(
  "/:proposal_id",
  proposalVotingHistoryController.getProposalVotingHistory
);

export default router;
