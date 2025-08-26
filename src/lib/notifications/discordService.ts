import {
  Client,
  GatewayIntentBits,
  TextChannel,
  EmbedBuilder,
} from "discord.js";

interface DiscordConfig {
  botToken: string;
}

export class DiscordService {
  private client: Client;
  private isReady: boolean = false;

  constructor(config: DiscordConfig) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.client.once("ready", () => {
      console.log(`Discord bot ready as ${this.client.user?.tag}`);
      this.isReady = true;
    });

    this.client.on("error", (error) => {
      console.error("Discord client error:", error);
    });

    this.client.login(config.botToken).catch((error) => {
      console.error("Failed to login to Discord:", error);
    });
  }

  static fromEnv(): DiscordService {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is required");
    }
    return new DiscordService({ botToken });
  }

  private async waitForReady(timeoutMs: number = 10000): Promise<void> {
    if (this.isReady) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Discord bot failed to become ready within timeout"));
      }, timeoutMs);

      const checkReady = () => {
        if (this.isReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  async sendEmbed(channelId: string, embed: EmbedBuilder): Promise<void> {
    try {
      await this.waitForReady();

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      await (channel as TextChannel).send({ embeds: [embed] });
      console.log(`Discord embed sent to channel ${channelId}`);
    } catch (error) {
      console.error("Failed to send Discord embed:", error);
      throw error;
    }
  }
}
