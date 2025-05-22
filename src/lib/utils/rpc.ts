export const getRpcUrl = ({
  networkId,
  useArchivalNode = false,
}: {
  networkId: string;
  useArchivalNode?: boolean;
}) => {
  return `https://${
    useArchivalNode ? "archival-" : ""
  }rpc.${networkId}.fastnear.com?apiKey=${process.env.FASTNEAR_API_KEY}`;
};
