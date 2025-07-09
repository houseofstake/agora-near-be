import dotenv from "dotenv";
import app from "./app";
import { prismaPublic } from "./lib/prisma-public";
import { prismaWeb2 } from "./lib/prisma-web2";

// Load environment variables
dotenv.config();

const port = process.env.PORT || 8080;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Disconnect both Prisma clients
    await Promise.all([prismaPublic.$disconnect(), prismaWeb2.$disconnect()]);

    console.log("Database connections closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Handle multiple termination signals for comprehensive coverage
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Ctrl+C
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Termination signal (Docker, PM2, etc.)
process.on("beforeExit", () => gracefulShutdown("beforeExit")); // Normal exit

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
