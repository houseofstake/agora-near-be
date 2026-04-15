import { Request, Response } from "express";
import { prisma } from "../../index";
import { fetchNearSocialProfiles } from "../../lib/services/near-social";

const BATCH_SIZE = 50;

export class CronController {
  async syncSocialProfiles(req: Request, res: Response): Promise<void> {
    const cronSecret = req.headers["x-cron-secret-key"];

    // Authorization
    if (
      !process.env.WATCHDOG_VP_API_SECRET || 
      cronSecret !== process.env.WATCHDOG_VP_API_SECRET
    ) {
      res.status(401).json({
        error: "Unauthorized: Invalid or missing x-cron-secret-key",
      });
      return;
    }

    try {
      console.log("Starting NEAR Social profile synchronization...");

      // 1. Fetch all registered voters instead of just those with statements
      const voters = await prisma.$queryRaw<{ registered_voter_id: string }[]>`
        SELECT registered_voter_id FROM fastnear.registered_voters
        WHERE registered_voter_id IS NOT NULL
      `;

      console.log(`Found ${voters.length} registered voters to sync.`);

      if (voters.length === 0) {
        res.status(200).json({
          status: "success",
          message: "No registered voters found to sync.",
          updatedCount: 0,
        });
        return;
      }

      // 2. Preload existing delegate statements into memory for quick diffing
      const existingStatements = await prisma.delegate_statements.findMany({
        select: {
          address: true,
          statement: true,
          twitter: true,
        },
      });
      const existingMap = new Map(existingStatements.map((s) => [s.address, s]));

      let updatedCount = 0;

      for (let i = 0; i < voters.length; i += BATCH_SIZE) {
        const batch = voters.slice(i, i + BATCH_SIZE);
        const addresses = batch.map((v) => v.registered_voter_id);

        const profiles = await fetchNearSocialProfiles(addresses, "mainnet");

        const upserts = [];

        for (const address of addresses) {
          const profile = profiles[address];
          if (!profile) continue;

          const existing = existingMap.get(address);

          const newStatement = profile.description ?? "";
          const newTwitter = profile.linktree?.twitter ?? null;

          if (!existing) {
            // Only create a new entry if there is meaningful content to store
            if (profile.description || profile.linktree?.twitter) {
              upserts.push(
                prisma.delegate_statements.create({
                  data: {
                    address,
                    statement: newStatement,
                    twitter: newTwitter,
                    signature: "CRON_SYNC_TOS_NOT_SIGNED",
                    publicKey: "CRON_SYNC_PUBLIC_KEY",
                    message: "CRON_SYNC_MESSAGE",
                    agreeCodeConduct: false,
                  },
                }),
              );
            }
          } else {
            // Build a partial update payload — only update fields that have new content.
            // This prevents the CRON from overwriting a manually-signed statement
            // with "" if a delegate removes their NEAR Social bio.
            const updatePayload: { statement?: string; twitter?: string | null } = {};

            if (profile.description && newStatement !== existing.statement) {
              updatePayload.statement = newStatement;
            }
            if (profile.linktree?.twitter && newTwitter !== existing.twitter) {
              updatePayload.twitter = newTwitter;
            }

            if (Object.keys(updatePayload).length > 0) {
              upserts.push(
                prisma.delegate_statements.update({
                  where: { address },
                  data: updatePayload,
                }),
              );
            }
          }
        }

        if (upserts.length > 0) {
          await Promise.all(upserts);
          updatedCount += upserts.length;
        }

        console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}. Upserts: ${upserts.length}`);
      }

      console.log(`Synchronization complete. Total profiles upserted: ${updatedCount}`);

      res.status(200).json({
        status: "success",
        message: "NEAR Social profiles synchronized successfully.",
        profilesProcessed: voters.length,
        updatedCount,
      });
    } catch (error) {
      console.error("Cron Controller Error (syncSocialProfiles):", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
