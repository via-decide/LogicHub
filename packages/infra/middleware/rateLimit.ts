import { redis } from "../redis/client.js";

export async function rateLimit(ip: string, limit: number = 100, windowSeconds: number = 60) {
  const key = `rate:${ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (count > limit) {
    throw new Error("Rate limit exceeded");
  }

  return count;
}
