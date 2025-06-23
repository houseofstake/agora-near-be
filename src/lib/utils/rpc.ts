export const getRpcUrl = ({
  networkId,
  useArchivalNode = false,
}: {
  networkId?: unknown;
  useArchivalNode?: boolean;
}) => {
  const sanitizedNetworkId =
    typeof networkId === "string" && networkId === "testnet"
      ? "testnet"
      : "mainnet";

  return `https://${
    useArchivalNode ? "archival-" : ""
  }rpc.${sanitizedNetworkId}.fastnear.com?apiKey=${
    process.env.FASTNEAR_API_KEY
  }`;
};
