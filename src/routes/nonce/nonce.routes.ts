import express from "express";
import { NonceController } from "../../controllers/nonce/nonce.controller";

const router = express.Router();
const nonceController = new NonceController();

// POST /nonce - Generate a new nonce
router.post("/", nonceController.generateNonce);

export default router;
