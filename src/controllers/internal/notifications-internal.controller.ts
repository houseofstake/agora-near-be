import { Request, Response } from "express";
import { prisma } from "../..";

const PREFERENCE_KEYS = [
  "wants_proposal_created_email",
  "wants_proposal_ending_soon_email",
] as const;

type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export class NotificationsInternalController {
  getDelegateEmailsByPreference = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const secret = req.headers["x-internal-notifications-secret"];
    if (
      !process.env.WATCHDOG_VP_API_SECRET ||
      secret !== process.env.WATCHDOG_VP_API_SECRET
    ) {
      res.status(401).json({
        error: "Unauthorized: Invalid or missing WATCHDOG_VP_API_SECRET",
      });
      return;
    }

    const raw = req.query.preference;
    const rawPref =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : undefined;
    if (!rawPref || !(PREFERENCE_KEYS as readonly string[]).includes(rawPref)) {
      res.status(400).json({
        error: "Invalid or missing preference query param",
        allowed: PREFERENCE_KEYS,
      });
      return;
    }

    const preference = rawPref as PreferenceKey;

    try {
      const delegates = await prisma.delegate_statements.findMany({
        where: {
          email: { not: null },
          notification_preferences: {
            path: [preference],
            equals: "true",
          },
        },
        select: {
          email: true,
          notification_preferences: true,
        },
      });

      res.status(200).json({ delegates });
    } catch (error) {
      console.error("notifications internal delegate-emails:", error);
      res.status(500).json({ error: "Failed to fetch delegates" });
    }
  };
}
