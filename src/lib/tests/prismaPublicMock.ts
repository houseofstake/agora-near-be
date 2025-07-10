import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

import { prismaPublic } from "../prisma-public";

jest.mock("../prisma-public", () => ({
  prismaPublic: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaPublicMock);
});

export const prismaPublicMock =
  prismaPublic as unknown as DeepMockProxy<PrismaClient>;
