import { Request, Response } from "express";
import { runWatchdogAudit } from "../../scripts/monitorVotingPower";

export class WatchdogController {
  async runVotingPowerAudit(req: Request, res: Response): Promise<void> {
    const cronSecret = req.headers["x-watchdog-secret-key"];
    
    // Fallback to strict authorization matching against environment variables
    if (!process.env.WATCHDOG_VP_API_SECRET || cronSecret !== process.env.WATCHDOG_VP_API_SECRET) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing WATCHDOG_VP_API_SECRET" });
      return;
    }

    try {
      await runWatchdogAudit();
      res.status(200).json({ status: "success", message: "Voting Power Audit passed perfectly." });
    } catch (error) {
      console.error("Watchdog Controller Error:", error);
      // Trigger API 500 error to actively flag Datadog APM monitors
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
