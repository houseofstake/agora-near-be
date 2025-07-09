import { PrismaClient } from "../generated/prisma-public";

// Public schema client - for read-only access to views and blockchain data
export const prismaPublic = new PrismaClient();
