import express from "express";
import { NearController } from "../../controllers/near/near.controller";

const router = express.Router();
const nearController = new NearController();

router.get("/price", nearController.getNearPrice);

export { router as nearRoutes };
