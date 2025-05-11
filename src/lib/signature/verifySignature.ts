import * as borsh from "borsh";
import * as js_sha256 from "js-sha256";
import { utils } from "near-api-js";

class Payload {
  tag: number;
  message: string;

  constructor({ message }: { message: string }) {
    this.tag = 2147484061;
    this.message = message;
  }
}

const payloadSchema = {
  struct: {
    tag: "u32",
    message: "string",
  },
};

export const verifySignature = ({
  message,
  signature,
  publicKey,
}: {
  message: string;
  signature: string;
  publicKey: string;
}) => {
  const payload = new Payload({ message });
  const serialized = borsh.serialize(payloadSchema, payload);
  const to_sign = Uint8Array.from(js_sha256.sha256.array(serialized));

  // Reconstruct the signature from the parameter given in the URL
  let real_signature = Buffer.from(signature, "base64");

  // Use the public Key to verify that the private-counterpart signed the message
  const myPK = utils.PublicKey.from(publicKey);
  return myPK.verify(to_sign, real_signature);
};
