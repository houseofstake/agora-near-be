import express from "express";
import { VenearController } from "../../controllers/venear/venear.controller";

const router = express.Router();
const venearController = new VenearController();

router.get("/total-supply-history", venearController.getTotalSupplyHistory);

export { router as venearRoutes };
