import dotenv from "dotenv";
import app from "./app";
import { PrismaClient } from "./generated/prisma";

// Load environment variables
dotenv.config();

require("dd-trace").init({
  logInjection: true,
});

const port = process.env.PORT || 8080;

export const prisma = new PrismaClient();

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  try {
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("beforeExit", () => gracefulShutdown("beforeExit"));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
