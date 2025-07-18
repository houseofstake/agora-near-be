import { EmailService } from "./emailService";
import { TelegramService } from "./telegramService";
import { DiscordService } from "./discordService";
import { prisma } from "../../index";
import {
  EMAIL_TEMPLATE,
  generateSubject,
  formatTimeRemaining,
  formatVotingPeriod,
} from "./emailTemplates";

interface NotificationData {
  proposalTitle: string;
  proposalId: string;
  proposalUrl?: string;
  endDate?: Date;
  startDate?: Date;
  signalType?: "proposal_created" | "proposal_ending_soon";
  votingPeriod?: string;
  timeRemaining?: string;
}

interface ProcessedNotifications {
  proposalCreated: NotificationData[];
  proposalEndingSoon: NotificationData[];
  deduplicated: NotificationData[];
}

interface EmailContext {
  subject: string;
  subtitle: string;
  proposals: NotificationData[];
  logoUrl: string;
  unsubscribeUrl: string;
}

export class NotificationManager {
  private emailService: EmailService;
  private telegramService?: TelegramService;
  private discordService?: DiscordService;

  // Environment flags for safe deployment
  private readonly DEVELOPER_MODE =
    process.env.DEVELOPER_MODE?.toLowerCase() === "true";
  private readonly SAFE_MODE = process.env.SAFE_MODE?.toLowerCase() === "true";
  private readonly SEND_EMAIL =
    process.env.SEND_EMAIL?.toLowerCase() !== "false";

  constructor() {
    this.emailService = EmailService.fromEnv();

    try {
      this.telegramService = TelegramService.fromEnv();
    } catch (error) {
      console.warn("Telegram service not available:", error);
    }

    try {
      this.discordService = DiscordService.fromEnv();
    } catch (error) {
      console.warn("Discord service not available:", error);
    }
  }

  private processNotifications(
    createdProposals: NotificationData[],
    endingSoonProposals: NotificationData[]
  ): ProcessedNotifications {
    // Mark signal types and format data
    const proposalCreated = createdProposals.map((p) => ({
      ...p,
      signalType: "proposal_created" as const,
      votingPeriod:
        p.startDate && p.endDate
          ? formatVotingPeriod(p.startDate, p.endDate)
          : undefined,
    }));

    const proposalEndingSoon = endingSoonProposals.map((p) => ({
      ...p,
      signalType: "proposal_ending_soon" as const,
      timeRemaining: p.endDate ? formatTimeRemaining(p.endDate) : undefined,
    }));

    // Deduplication: if proposal is in both lists, keep only in ending-soon
    const endingSoonIds = new Set(proposalEndingSoon.map((p) => p.proposalId));
    const deduplicatedCreated = proposalCreated.filter(
      (p) => !endingSoonIds.has(p.proposalId)
    );

    // Combine and prioritize ending soon first
    const deduplicated = [...proposalEndingSoon, ...deduplicatedCreated];

    return {
      proposalCreated: deduplicatedCreated,
      proposalEndingSoon,
      deduplicated,
    };
  }

  /**
   * Build email context with proper subject generation
   */
  private buildEmailContext(
    notifications: ProcessedNotifications
  ): EmailContext {
    const { proposalCreated, proposalEndingSoon, deduplicated } = notifications;

    const subject = generateSubject(
      proposalCreated.length,
      proposalEndingSoon.length
    );
    const subtitle =
      "Your vote matters—cast your input and help shape the future of NEAR!";

    return {
      subject,
      subtitle,
      proposals: deduplicated,
      logoUrl:
        "https://storage.googleapis.com/agora-public-assets/logos/near.png",
      unsubscribeUrl: "%unsubscribe_url%", // MailGun placeholder
    };
  }

  /**
   * Get delegates who opted into specific email notifications
   */
  private async getDelegatesWithEmailPreferences(
    preferenceKey:
      | "wants_proposal_created_email"
      | "wants_proposal_ending_soon_email"
  ) {
    return await prisma.delegate_statements.findMany({
      where: {
        email: { not: null },
        notification_preferences: {
          path: [preferenceKey],
          equals: "true",
        },
      },
      select: {
        email: true,
        notification_preferences: true,
      },
    });
  }

  /**
   * Check if email should be sent based on safe mode settings
   */
  private shouldSendEmail(email: string): boolean {
    if (!this.SEND_EMAIL) return false;

    const isEmployee = email.endsWith("voteagora.com");
    const isTestAccount = ["pedro@voteagora.com"].includes(email);

    return this.SAFE_MODE ? isEmployee || isTestAccount : true;
  }

  /**
   * Send consolidated email using professional template from EmailService
   */
  private async sendConsolidatedEmail(
    email: string,
    context: EmailContext
  ): Promise<void> {
    if (!this.shouldSendEmail(email)) {
      console.log(`Skipping email to ${email} due to safe mode restrictions`);
      return;
    }

    try {
      // Use developer email override if in dev mode
      const targetEmail = this.DEVELOPER_MODE ? "pedro@voteagora.com" : email;

      // Separate proposals by type for the EmailService
      const createdProposals = context.proposals.filter(
        (p) => p.signalType === "proposal_created"
      );
      const endingSoonProposals = context.proposals.filter(
        (p) => p.signalType === "proposal_ending_soon"
      );

      if (
        createdProposals.length > 0 &&
        endingSoonProposals.length === 0 &&
        createdProposals.length === 1
      ) {
        // Send proposal created email
        const proposal = createdProposals[0];
        await this.emailService.sendProposalCreatedEmail(
          targetEmail,
          proposal.proposalTitle,
          proposal.proposalId,
          proposal.proposalUrl,
          proposal.startDate,
          proposal.endDate
        );
      } else if (
        endingSoonProposals.length > 0 &&
        createdProposals.length === 0 &&
        endingSoonProposals.length === 1
      ) {
        // Send proposal ending soon email
        const proposal = endingSoonProposals[0];
        await this.emailService.sendProposalEndingSoonEmail(
          targetEmail,
          proposal.proposalTitle,
          proposal.proposalId,
          proposal.endDate!,
          proposal.proposalUrl
        );
      } else if (
        createdProposals.length > 0 ||
        endingSoonProposals.length > 0
      ) {
        // Send consolidated email with multiple proposals using the email service method
        await this.sendMultiProposalEmail(targetEmail, context);
      }

      console.log(`Email sent successfully to ${targetEmail}`);
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send multi-proposal email using the EmailService's template system
   */
  private async sendMultiProposalEmail(
    email: string,
    context: EmailContext
  ): Promise<void> {
    // Transform proposals to match EmailService template format
    const proposals = context.proposals.map((proposal) => ({
      signal_type:
        proposal.signalType === "proposal_created"
          ? "proposal_created"
          : "proposal_ending_soon_and_not_voted",
      title: proposal.proposalTitle,
      proposal_url: proposal.proposalUrl || "#",
      start_block: proposal.startDate
        ? `Block ${Math.floor(proposal.startDate.getTime() / 1000)}`
        : "TBD",
      start_datetime: proposal.startDate
        ? proposal.startDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD",
      end_block: proposal.endDate
        ? `Block ${Math.floor(proposal.endDate.getTime() / 1000)}`
        : "TBD",
      end_datetime: proposal.endDate
        ? proposal.endDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD",
    }));

    const templateData = {
      logo_url: context.logoUrl,
      subject: context.subject,
      subtitle: context.subtitle,
      proposals,
      style: {
        "brand-primary": "#00C08B",
      },
      friendly_short_name: "NEAR",
      unsubscribe_url: context.unsubscribeUrl,
    };

    // Use the EmailService's template rendering method
    const html = this.emailService.renderTemplate(EMAIL_TEMPLATE, templateData);

    await this.emailService.sendEmail({
      to: email,
      subject: context.subject,
      html,
      text: this.generateTextVersion(context),
    });
  }

  private generateTextVersion(context: EmailContext): string {
    let text = `${context.subject}\n\n${context.subtitle}\n\n`;

    context.proposals.forEach((proposal, index) => {
      text += `${index + 1}. ${proposal.proposalTitle}\n`;
      text += `   ${
        proposal.signalType === "proposal_created" ? "🆕 NEW" : "⚠️ ENDING SOON"
      }\n`;
      if (proposal.proposalUrl) {
        text += `   Link: ${proposal.proposalUrl}\n`;
      }
      text += "\n";
    });

    text += "NEAR governance powered by Agora\n";
    text += "Unsubscribe: %unsubscribe_url%";

    return text;
  }

  /**
   * Send consolidated notifications to multiple users
   */
  async sendBulkNotifications(
    createdProposals: NotificationData[],
    endingSoonProposals: NotificationData[]
  ): Promise<void> {
    if (createdProposals.length === 0 && endingSoonProposals.length === 0) {
      console.log("No proposals to notify about");
      return;
    }

    const processed = this.processNotifications(
      createdProposals,
      endingSoonProposals
    );
    const emailContext = this.buildEmailContext(processed);

    console.log(
      `Processing notifications: ${processed.proposalCreated.length} new, ${processed.proposalEndingSoon.length} ending soon`
    );

    // Get delegates with email preferences
    const createdDelegates =
      processed.proposalCreated.length > 0
        ? await this.getDelegatesWithEmailPreferences(
            "wants_proposal_created_email"
          )
        : [];
    const endingSoonDelegates =
      processed.proposalEndingSoon.length > 0
        ? await this.getDelegatesWithEmailPreferences(
            "wants_proposal_ending_soon_email"
          )
        : [];

    // Combine and deduplicate email recipients
    const allEmails = new Set([
      ...createdDelegates.map((d) => d.email!),
      ...endingSoonDelegates.map((d) => d.email!),
    ]);

    console.log(`Sending emails to ${allEmails.size} unique recipients`);

    // Send emails in parallel
    const emailPromises = Array.from(allEmails).map((email) =>
      this.sendConsolidatedEmail(email, emailContext).catch((error) => {
        console.error(`Failed to send email to ${email}:`, error);
      })
    );

    // Send to broadcast channels if any proposals
    const broadcastPromises: Promise<void>[] = [];
    if (processed.deduplicated.length > 0) {
      if (this.telegramService && process.env.TELEGRAM_CHANNEL_ID) {
        broadcastPromises.push(this.sendTelegramBroadcast(emailContext));
      }
      if (this.discordService && process.env.DISCORD_CHANNEL_ID) {
        broadcastPromises.push(this.sendDiscordBroadcast(emailContext));
      }
    }

    await Promise.all([...emailPromises, ...broadcastPromises]);

    console.log(
      `Successfully processed ${processed.deduplicated.length} proposals for ${allEmails.size} recipients`
    );
  }

  private async sendTelegramBroadcast(context: EmailContext): Promise<void> {
    if (!this.telegramService || !process.env.TELEGRAM_CHANNEL_ID) return;

    try {
      let message = `🗳️ <b>${context.subject}</b>\n\n`;

      context.proposals.forEach((proposal, index) => {
        const emoji = proposal.signalType === "proposal_created" ? "🆕" : "⚠️";
        message += `${emoji} <b>${proposal.proposalTitle}</b>\n`;

        if (
          proposal.signalType === "proposal_ending_soon" &&
          proposal.timeRemaining
        ) {
          message += `⏰ Ends in: ${proposal.timeRemaining}\n`;
        }

        if (proposal.proposalUrl) {
          message += `<a href="${proposal.proposalUrl}">View Proposal</a>\n`;
        }
        if (index < context.proposals.length - 1) message += "\n";
      });

      await this.telegramService.sendMessage(
        process.env.TELEGRAM_CHANNEL_ID,
        message
      );
      console.log("Telegram broadcast sent successfully");
    } catch (error) {
      console.error("Failed to send Telegram broadcast:", error);
    }
  }

  private async sendDiscordBroadcast(context: EmailContext): Promise<void> {
    if (!this.discordService || !process.env.DISCORD_CHANNEL_ID) return;

    try {
      const { EmbedBuilder, Colors } = await import("discord.js");

      const embed = new EmbedBuilder()
        .setTitle(context.subject)
        .setDescription(context.subtitle)
        .setColor(Colors.Blue)
        .setTimestamp();

      context.proposals.forEach((proposal) => {
        const fieldName =
          proposal.signalType === "proposal_created"
            ? "🆕 New Proposal"
            : "⚠️ Ending Soon";

        let fieldValue = `**${proposal.proposalTitle}**\n`;

        if (
          proposal.signalType === "proposal_ending_soon" &&
          proposal.timeRemaining
        ) {
          fieldValue += `⏰ Ends in: ${proposal.timeRemaining}\n`;
        }

        fieldValue += `${
          proposal.proposalUrl
            ? `[View Proposal](${proposal.proposalUrl})`
            : "No link available"
        }`;

        embed.addFields({ name: fieldName, value: fieldValue, inline: false });
      });

      await this.discordService.sendEmbed(
        process.env.DISCORD_CHANNEL_ID,
        embed
      );
      console.log("Discord broadcast sent successfully");
    } catch (error) {
      console.error("Failed to send Discord broadcast:", error);
    }
  }
}
