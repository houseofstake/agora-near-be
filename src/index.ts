import dotenv from "dotenv";
import app from "./app";
import { PrismaClient } from "./generated/prisma";

// Load environment variables
dotenv.config();

const port = process.env.PORT || 8080;
export const prisma = new PrismaClient();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Database connection closed");
  process.exit(0);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
