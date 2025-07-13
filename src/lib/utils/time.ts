import Big from "big.js";

export function convertNanoSecondsToMs(nanoSeconds: string | null | undefined) {
  return Big(nanoSeconds ?? 0)
    .div(1000000)
    .toNumber();
}

export function convertMsToNanoSeconds(ms: number) {
  return Big(ms).mul(1000000).toFixed();
}
