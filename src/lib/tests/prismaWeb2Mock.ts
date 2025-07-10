import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

import { prismaWeb2 } from "../prisma-web2";

jest.mock("../prisma-web2", () => ({
  prismaWeb2: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaWeb2Mock);
});

export const prismaWeb2Mock =
  prismaWeb2 as unknown as DeepMockProxy<PrismaClient>;
