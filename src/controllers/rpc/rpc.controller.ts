import { Request, Response } from "express";
import { getRpcUrl } from "../../lib/utils/rpc";

export class RpcController {
  public rpcProxy = async (req: Request, res: Response): Promise<any> => {
    try {
      const { networkId } = req.params;

      const url = getRpcUrl({ networkId });

      const rpcRes = await fetch(url, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await rpcRes.json();

      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: `RPC call failed: ${error}` });
    }
  };

  public rpcArchivalProxy = async (
    req: Request,
    res: Response
  ): Promise<any> => {
    try {
      const { networkId } = req.params;
      const url = getRpcUrl({ networkId, useArchivalNode: true });

      const rpcRes = await fetch(url, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await rpcRes.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: `RPC call failed: ${error}` });
    }
  };
}
