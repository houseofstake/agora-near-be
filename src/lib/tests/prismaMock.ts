import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

import { prisma } from "../../index";

jest.mock("../../index", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
  (prismaMock.$transaction as any).mockImplementation(async (fn: any) => {
    return fn(prismaMock);
  });
  (prismaMock.$executeRaw as any).mockResolvedValue(0);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
