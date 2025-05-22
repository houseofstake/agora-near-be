import express from "express";
import { StakingController } from "../../controllers/staking/staking.controller";

const router = express.Router();
const stakingController = new StakingController();

router.get("/apy", stakingController.getAPY);

export { router as stakingRoutes };
