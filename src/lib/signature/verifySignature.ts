import * as borsh from "borsh";
import * as js_sha256 from "js-sha256";
import { utils } from "near-api-js";

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

export const verifySignature = ({
  message,
  signature,
  publicKey,
  recipient = RECIPIENT,
  nonce = NONCE,
}: {
  message: string;
  signature: string;
  publicKey: string;
  recipient?: string;
  nonce?: Buffer;
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
