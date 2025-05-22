import express from "express";
import { RpcController } from "../../controllers/rpc/rpc.controller";

const router = express.Router();
const rpcController = new RpcController();

router.post("/:networkId", rpcController.rpcProxy);

export { router as rpcRoutes };
