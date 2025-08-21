import * as borsh from "borsh";
import * as js_sha256 from "js-sha256";
import { utils } from "near-api-js";
import { getRpcUrl } from "../utils/rpc";
import { retrieveNonceForAccount } from "./nonce";

export interface SignedPayload<T extends Record<string, any>> {
  signature: string;
  publicKey: string;
  message: string;
  data: T;
}

class Payload {
  tag: number;
  message: string;
  nonce: Buffer;
  recipient: string;
  callbackUrl?: string;

  constructor({
    message,
    nonce,
    recipient,
    callbackUrl,
  }: {
    message: string;
    nonce: Buffer;
    recipient: string;
    callbackUrl?: string;
  }) {
    this.tag = 2147484061;
    this.message = message;
    this.nonce = nonce;
    this.recipient = recipient;
    if (callbackUrl) {
      this.callbackUrl = callbackUrl;
    }
  }
}

const payloadSchema = {
  struct: {
    tag: "u32",
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
};

const NONCE = Buffer.from(Array.from(Array(32).keys()));
const RECIPIENT = "agora-near-be";

async function verifyFullKeyBelongsToUser({
  publicKey,
  accountId,
  networkId,
}: {
  publicKey: string;
  accountId: string;
  networkId: string;
}) {
  // Call the public RPC asking for all the users' keys
  let data = await fetchAllUserKeys({ accountId, networkId });

  // if there are no keys, then the user could not sign it!
  if (!data || !data.result || !data.result.keys) return false;

  // check all the keys to see if we find the used_key there
  for (const k in data.result.keys) {
    if (data.result.keys[k].public_key === publicKey) {
      // Ensure the key is full access, meaning the user had to sign
      // the transaction through the wallet
      return data.result.keys[k].access_key.permission == "FullAccess";
    }
  }

  return false; // didn't find it
}

// Aux method
async function fetchAllUserKeys({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const keys = await fetch(getRpcUrl({ networkId }), {
    method: "post",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: `{"jsonrpc":"2.0", "method":"query", "params":["access_key/${accountId}", ""], "id":1}`,
  })
    .then((data) => data.json())
    .then((result) => result);
  return keys;
}

const isValidSignature = ({
  message,
  signature,
  publicKey,
  recipient,
  nonce,
}: {
  message: string;
  signature: string;
  publicKey: string;
  recipient: string;
  nonce: Buffer;
}) => {
  const payload = new Payload({
    message,
    nonce,
    recipient,
  });

  const serialized = borsh.serialize(payloadSchema, payload);
  const toSign = Uint8Array.from(js_sha256.sha256.array(serialized));
  const actualSignature = Buffer.from(signature, "base64");
  const pk = utils.PublicKey.fromString(publicKey);

  return pk.verify(toSign, actualSignature);
};

export const verifySignature = async ({
  message,
  signature,
  publicKey,
  networkId,
  accountId,
}: {
  message: string;
  signature: string;
  publicKey: string;
  networkId: string;
  accountId: string;
}) => {
  const nonce = await retrieveNonceForAccount(accountId);

  if (!nonce) {
    throw new Error("No nonce found");
  }

  const keyBelongsToUser = await verifyFullKeyBelongsToUser({
    accountId,
    publicKey,
    networkId,
  });

  const isValid = isValidSignature({
    message,
    signature,
    publicKey,
    recipient: RECIPIENT,
    nonce,
  });

  return isValid && keyBelongsToUser;
};

export const verifySignedPayload = async <T extends Record<string, any>>({
  signedPayload,
  networkId,
  accountId,
}: {
  signedPayload: SignedPayload<T>;
  networkId: string;
  accountId: string;
}): Promise<boolean> => {
  return verifySignature({
    message: signedPayload.message,
    signature: signedPayload.signature,
    publicKey: signedPayload.publicKey,
    networkId,
    accountId,
  });
};
