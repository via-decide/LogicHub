import { Queue } from "bullmq";
import { redis } from "../redis/client.js";

export const aiQueue = new Queue("ai-jobs", {
  connection: redis
});

console.log("🚀 AI Queue Initialized");
