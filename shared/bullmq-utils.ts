import { Queue } from "bullmq";
import { Redis, type RedisOptions } from "ioredis";

export function getQueue(
  queueName: string,
  connection: RedisOptions,
  queues: Map<string, Queue>,
): Queue {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, { connection });
    queues.set(queueName, queue);
  }
  return queues.get(queueName)!;
}

export async function discoverQueues(
  connection: RedisOptions,
): Promise<string[]> {
  try {
    const redis = new Redis(connection);

    const keys = await redis.keys("bull:*:meta");
    const queueNames = new Set<string>();

    for (const key of keys) {
      const match = key.match(/^bull:([^:]+):meta$/);
      if (match) {
        queueNames.add(match[1]);
      }
    }

    await redis.quit();
    return Array.from(queueNames);
  } catch (error) {
    console.error("Error discovering queues:", error);
    return [];
  }
}
