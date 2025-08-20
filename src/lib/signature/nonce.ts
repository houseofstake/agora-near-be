import { prisma } from "../..";

export const retrieveNonceForAccount = async (accountId: string) => {
  const cachedEntry = await prisma.cache.findFirst({
    where: {
      key: `nonce-${accountId}`,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  const cachedNonce = cachedEntry?.data as { nonce: string } | undefined;

  if (!cachedNonce?.nonce) {
    return null;
  }

  return Buffer.from(cachedNonce.nonce, "hex");
};
