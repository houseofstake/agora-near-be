import { PrismaClient } from "../generated/prisma-web2";

// Web2 schema client - for application data (delegate_statements, cache)
export const prismaWeb2 = new PrismaClient();
