import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new (Redis as any)(redisUrl, {
  maxRetriesPerRequest: null // Required for BullMQ
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err: any) => console.error("❌ Redis error:", err));
