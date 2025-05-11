import express from "express";
import voteRoutes from "./votes.routes";

const router = express.Router();

router.use("/votes", voteRoutes);

export { router as proposalRoutes };
