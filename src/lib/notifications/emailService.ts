import Mailgun from "mailgun.js";
import formData from "form-data";
import {
  EMAIL_TEMPLATE,
  generateSubject,
  formatTimeRemaining,
} from "./emailTemplates";

interface MailgunConfig {
  apiKey: string;
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private mailgun: any;
  private domain: string = "notifications.voteagora.com";

  constructor(config: MailgunConfig) {
    const mg = new Mailgun(formData);
    this.mailgun = mg.client({
      username: "api",
      key: config.apiKey,
      url: "https://api.mailgun.net",
    });
  }

  static fromEnv(): EmailService {
    const config: MailgunConfig = {
      apiKey: process.env.MAILGUN_API_KEY || "",
    };

    if (!config.apiKey) {
      throw new Error("MAILGUN_API_KEY environment variable is required");
    }

    return new EmailService(config);
  }

  async sendEmail(data: EmailData): Promise<void> {
    try {
      const messageData = {
        from: "NEAR Governance <no-reply@notifications.voteagora.com>",
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text || this.htmlToText(data.html),
        // Mailgun-specific features
        "o:tracking": "yes",
        "o:tracking-clicks": "yes",
        "o:tracking-opens": "yes",
      };

      const result = await this.mailgun.messages.create(
        this.domain,
        messageData
      );
      console.log("Email sent via Mailgun:", result.id);
    } catch (error) {
      console.error("Failed to send email via Mailgun:", error);
      throw error;
    }
  }

  private htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  public renderTemplate(template: string, data: any): string {
    let rendered = template;

    // Handle loops FIRST {% for proposal in proposals %}...{% endfor %}
    rendered = rendered.replace(
      /\{% for proposal in proposals %\}([\s\S]*?)\{% endfor %\}/g,
      (match: string, loopContent: string) => {
        if (!data.proposals || !Array.isArray(data.proposals)) {
          return "";
        }

        return data.proposals
          .map((proposal: any, index: number) => {
            let itemContent = loopContent;

            // Replace proposal variables
            itemContent = itemContent.replace(
              /\{\{\s*proposal\.([^}]+)\s*\}\}/g,
              (match: string, prop: string) => {
                const cleanProp = prop.trim();
                return proposal[cleanProp] !== undefined
                  ? String(proposal[cleanProp])
                  : match;
              }
            );

            // Handle conditional blocks
            itemContent = itemContent.replace(
              /\{% if proposal\.signal_type == '([^']+)' %\}([\s\S]*?)\{% elif proposal\.signal_type == '([^']+)' %\}([\s\S]*?)\{% endif %\}/g,
              (
                match: string,
                type1: string,
                content1: string,
                type2: string,
                content2: string
              ) => {
                if (proposal.signal_type === type1) {
                  return content1;
                } else if (proposal.signal_type === type2) {
                  return content2;
                }
                return "";
              }
            );

            itemContent = itemContent.replace(
              /\{% if proposal\.signal_type == '([^']+)' %\}([\s\S]*?)\{% endif %\}/g,
              (match: string, type: string, content: string) => {
                return proposal.signal_type === type ? content : "";
              }
            );

            // Handle loop.last logic for separators
            const isLast = index === data.proposals.length - 1;
            itemContent = itemContent.replace(
              /\{% if not loop\.last %\}([\s\S]*?)\{% endif %\}/g,
              (match: string, content: string) => {
                return !isLast ? content : "";
              }
            );

            return itemContent;
          })
          .join("");
      }
    );

    // THEN replace simple variables {{ variable }} (but skip proposal.* variables since they've been handled)
    rendered = rendered.replace(
      /\{\{\s*([^}]+)\s*\}\}/g,
      (match: string, variable: string) => {
        // Skip proposal variables as they should have been handled in the loop
        if (variable.trim().startsWith("proposal.")) {
          return match;
        }

        const keys = variable
          .trim()
          .replace(/'/g, "")
          .split(/[\.\[\]'"]/)
          .filter(Boolean);
        let value = data;
        for (const key of keys) {
          value = value?.[key];
        }
        return value !== undefined ? String(value) : match;
      }
    );

    return rendered;
  }

  async sendProposalCreatedEmail(
    email: string,
    proposalTitle: string,
    proposalId: string,
    proposalUrl?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<void> {
    const proposals = [
      {
        signal_type: "proposal_created",
        title: proposalTitle,
        proposal_url:
          proposalUrl ||
          `https://agora-near.vercel.app/proposals/${proposalId}`,
        start_block: startDate
          ? `Block ${Math.floor(startDate.getTime() / 1000)}`
          : "TBD",
        start_datetime: startDate
          ? startDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "TBD",
        end_block: endDate
          ? `Block ${Math.floor(endDate.getTime() / 1000)}`
          : "TBD",
        end_datetime: endDate
          ? endDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "TBD",
      },
    ];

    const subject = generateSubject(1, 0);

    const templateData = {
      logo_url:
        "https://storage.googleapis.com/agora-public-assets/logos/near.png",
      subject,
      subtitle:
        "Your vote matters—cast your input and help shape the future of your organization!",
      proposals,
      style: {
        "brand-primary": "#00C08B",
      },
      friendly_short_name: "NEAR",
      unsubscribe_url: `%unsubscribe_url%`,
    };

    const html = this.renderTemplate(EMAIL_TEMPLATE, templateData);

    const text = `
New Proposal: ${proposalTitle}

A new proposal has been created that you may be interested in:

Proposal ID: ${proposalId}
${proposalUrl ? `Link: ${proposalUrl}` : ""}

View the proposal at: https://agora-near.vercel.app/proposals/${proposalId}

You received this email because you have enabled "new proposal" notifications.
    `;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendProposalEndingSoonEmail(
    email: string,
    proposalTitle: string,
    proposalId: string,
    endDate: Date,
    proposalUrl?: string
  ): Promise<void> {
    const proposals = [
      {
        signal_type: "proposal_ending_soon_and_not_voted",
        title: proposalTitle,
        proposal_url:
          proposalUrl ||
          `https://agora-near.vercel.app/proposals/${proposalId}`,
        end_block: `Block ${Math.floor(endDate.getTime() / 1000)}`,
        end_datetime: endDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];

    const subject = generateSubject(0, 1);

    const templateData = {
      logo_url:
        "https://storage.googleapis.com/agora-public-assets/logos/near.png",
      subject,
      subtitle:
        "Your vote matters—cast your input and help shape the future of your organization!",
      proposals,
      style: {
        "brand-primary": "#00C08B",
      },
      friendly_short_name: "NEAR",
      unsubscribe_url: `%unsubscribe_url%`,
    };

    const html = this.renderTemplate(EMAIL_TEMPLATE, templateData);

    const text = `
Proposal Ending Soon: ${proposalTitle}

A proposal you may be interested in is ending soon:

Proposal ID: ${proposalId}
Time Remaining: ${formatTimeRemaining(endDate)}
Voting Ends: ${endDate.toLocaleString()}
${proposalUrl ? `Link: ${proposalUrl}` : ""}

Don't miss your chance to vote on this proposal!

Vote now at: https://agora-near.vercel.app/proposals/${proposalId}

You received this email because you have enabled "proposal ending soon" notifications.
    `;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}
