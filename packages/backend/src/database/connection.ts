/**
 * Prisma Client Connection
 * Singleton pattern for database connection
 */

import { PrismaClient } from "@prisma/client";
import logger from "../config/logger.js";

// Extend PrismaClient with logging
class PrismaClientExtended extends PrismaClient {
  constructor() {
    super({
      log: [
        { level: "query", emit: "event" },
        { level: "error", emit: "stdout" },
        { level: "warn", emit: "stdout" },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === "development") {
      this.$on("query" as any, (e: any) => {
        logger.debug("Query: " + e.query);
        logger.debug("Params: " + e.params);
        logger.debug("Duration: " + e.duration + "ms");
      });
    }
  }
}

// Global variable to store Prisma instance
const globalForPrisma = global as unknown as { prisma: PrismaClientExtended };

// Create or reuse Prisma client instance
export const prisma = globalForPrisma.prisma || new PrismaClientExtended();

// In development, attach to global to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

/**
 * Health check for database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Database connection healthy");
    return true;
  } catch (error) {
    logger.error("Database connection failed:", error);
    return false;
  }
}

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await checkDatabaseConnection();
    logger.info("Database initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize database:", error);
    throw error;
  }
}
