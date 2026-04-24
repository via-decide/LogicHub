import { Worker } from "bullmq";
import { redis } from "../redis/client.js";

export const createAIWorker = (processFn: (data: any) => Promise<any>) => {
  const worker = new Worker("ai-jobs", async job => {
    const { repo_url } = job.data;
    console.log(`[Worker] Processing job ${job.id}: ${repo_url}`);
    
    try {
      await processFn(job.data);
      console.log(`[Worker] Completed job ${job.id}`);
    } catch (err) {
      console.error(`[Worker] Failed job ${job.id}:`, err);
      throw err;
    }
  }, { 
    connection: redis,
    concurrency: 5 // Process 5 jobs at a time
  });

  return worker;
};
