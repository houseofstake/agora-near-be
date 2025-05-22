import { providers } from "near-api-js";

/**
 * Call a view method at a given block (or 'final' by default) and return the result.
 */
export async function fetchPriceAtBlock(
  provider: providers.JsonRpcProvider,
  contractId: string,
  methodName: string,
  blockId?: number
) {
  const argsBase64 = Buffer.from(JSON.stringify({})).toString("base64");

  const queryArgs = {
    request_type: "call_function",
    account_id: contractId,
    method_name: methodName,
    args_base64: argsBase64,
    block_id: blockId,
    finality: blockId ? undefined : "final",
  };

  const res = await provider.query(queryArgs);

  const resultArray = (res as any).result;
  const jsonResult = JSON.parse(Buffer.from(resultArray).toString());

  return Number(jsonResult);
}
