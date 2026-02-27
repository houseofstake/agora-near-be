/**
 * NEAR contract IDs used by the backend.
 */
const getVenearContractId = (): string => {
  switch (process.env.AGORA_ENV) {
    case "prod":
      return "venear.dao";
    case "staging":
      return "venear.stagingdao.near";
    case "dev":
    case "local":
    default:
      return "vt.voteagora.near";
  }
};

export const VENEAR_CONTRACT_ID = getVenearContractId();
