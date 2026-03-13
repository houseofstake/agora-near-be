import { Request, Response } from "express";
import crypto from "crypto";
import { verifySignedPayload } from "../../lib/signature/verifySignature";
import { prisma } from "../../index";
const hashApiKey = (key: string) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};

const KEY_PREFIX = "hos_live_";

export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const { signature, publicKey, data, message } = req.body;
    const networkId = req.query.network_id?.toString() || "mainnet";

    const isVerified = await verifySignedPayload({
      signedPayload: { signature, publicKey, message, data },
      networkId,
      accountId: data.accountId,
    });

    if (!isVerified) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const keys = await prisma.api_keys.findMany({
      where: {
        accountId: data.accountId,
      },
      select: {
        id: true,
        keyHint: true,
        email: true,
        scopes: true,
        metadata: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(keys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return res.status(500).json({ error: "Failed to fetch API keys" });
  }
};

export const generateApiKey = async (req: Request, res: Response) => {
  try {
    const { signature, publicKey, data, message } = req.body;
    const networkId = req.query.network_id?.toString() || "mainnet";

    const isVerified = await verifySignedPayload({
      signedPayload: { signature, publicKey, message, data },
      networkId,
      accountId: data.accountId,
    });

    if (!isVerified) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { email, scopes = ["full"] } = data;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const randomString = crypto.randomBytes(32).toString("hex");
    const plainTextKey = `${KEY_PREFIX}${randomString}`;

    const keyHash = hashApiKey(plainTextKey);
    const keyHint = `${KEY_PREFIX}${randomString.substring(0, 4)}...`;

    const newKey = await prisma.api_keys.create({
      data: {
        accountId: data.accountId,
        email,
        keyHash,
        keyHint,
        scopes,
        metadata: {},
      },
    });

    return res.status(201).json({
      id: newKey.id,
      plainTextKey,
      keyHint: newKey.keyHint,
      scopes: newKey.scopes,
      createdAt: newKey.createdAt,
    });
  } catch (error) {
    console.error("Error generating API key:", error);
    return res.status(500).json({ error: "Failed to generate API key" });
  }
};

export const revokeApiKey = async (req: Request, res: Response) => {
  try {
    const { signature, publicKey, data, message } = req.body;
    const networkId = req.query.network_id?.toString() || "mainnet";

    const isVerified = await verifySignedPayload({
      signedPayload: { signature, publicKey, message, data },
      networkId,
      accountId: data.accountId,
    });

    if (!isVerified) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { id } = req.params;

    const existingKey = await prisma.api_keys.findFirst({
      where: {
        id,
        accountId: data.accountId,
      },
    });

    if (!existingKey) {
      return res
        .status(404)
        .json({ error: "API key not found or unauthorized" });
    }

    await prisma.api_keys.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({ message: "API key revoked successfully" });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return res.status(500).json({ error: "Failed to revoke API key" });
  }
};

export const updateApiKeyScopes = async (req: Request, res: Response) => {
  try {
    const { signature, publicKey, data, message } = req.body;
    const networkId = req.query.network_id?.toString() || "mainnet";

    const isVerified = await verifySignedPayload({
      signedPayload: { signature, publicKey, message, data },
      networkId,
      accountId: data.accountId,
    });

    if (!isVerified) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { id } = req.params;
    const { scopes } = data;

    if (!Array.isArray(scopes)) {
      return res.status(400).json({ error: "Scopes must be an array." });
    }

    const existingKey = await prisma.api_keys.findFirst({
      where: {
        id,
        accountId: data.accountId,
      },
    });

    if (!existingKey) {
      return res
        .status(404)
        .json({ error: "API key not found or unauthorized" });
    }

    const updatedKey = await prisma.api_keys.update({
      where: {
        id,
      },
      data: {
        scopes,
      },
    });

    return res.status(200).json({
      message: "API key scopes updated successfully",
      scopes: updatedKey.scopes,
    });
  } catch (error) {
    console.error("Error updating API key scopes:", error);
    return res.status(500).json({ error: "Failed to update API key scopes" });
  }
};
