import { Bot } from "grammy";

interface TelegramConfig {
  botToken: string;
}

export class TelegramService {
  private bot: Bot;

  constructor(config: TelegramConfig) {
    this.bot = new Bot(config.botToken);
  }

  static fromEnv(): TelegramService {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
    }
    return new TelegramService({ botToken });
  }

  async sendMessage(chatId: string, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, message, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
      console.log(`Telegram message sent to chat ${chatId}`);
    } catch (error) {
      console.error("Failed to send Telegram message:", error);
      throw error;
    }
  }
}
