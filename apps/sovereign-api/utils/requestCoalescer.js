/**
 * Zayvora Request Coalescer
 * ------------------------
 * Prevents "Thundering Herd" on expensive LLM inference tasks.
 * Ensures that multiple identical requests only trigger ONE execution.
 */

export class RequestCoalescer {
  constructor() {
    this.inFlight = new Map();
    this.cache = new Map(); // Simple short-lived response cache
    this.ttl = 300000; // 5 minutes default
  }

  /**
   * Execute a task or join an existing in-flight execution.
   * @param {string} key - Unique key for the request (e.g. hash of the prompt)
   * @param {Function} task - The expensive async function to execute
   */
  async coalesce(key, task) {
    // 1. Check short-lived cache
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp < this.ttl)) {
      console.log(`[COALESCER] Cache Hit: ${key.substring(0, 8)}...`);
      return cached.data;
    }

    // 2. Check if already in-flight
    if (this.inFlight.has(key)) {
      console.log(`[COALESCER] Joining In-Flight: ${key.substring(0, 8)}...`);
      return this.inFlight.get(key);
    }

    // 3. Start new execution
    console.log(`[COALESCER] New Execution: ${key.substring(0, 8)}...`);
    const promise = task().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);

    try {
      const result = await promise;
      // Store in short-lived cache
      this.cache.set(key, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export const zayvoraCoalescer = new RequestCoalescer();
