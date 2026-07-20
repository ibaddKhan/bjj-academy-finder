import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Singleton Redis connection
const globalForRedis = globalThis as unknown as {
  redisConnection: IORedis | undefined;
};

export function getRedisConnection(): IORedis {
  if (globalForRedis.redisConnection) {
    return globalForRedis.redisConnection;
  }
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  globalForRedis.redisConnection = connection;
  return connection;
}

export const JOB_QUEUE_NAME = "bjj-jobs";

// Queue singleton
const globalForQueue = globalThis as unknown as {
  bjjQueue: Queue | undefined;
};

export function getQueue(): Queue {
  if (globalForQueue.bjjQueue) {
    return globalForQueue.bjjQueue;
  }
  const queue = new Queue(JOB_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 1, // We handle retries at the row level
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
  globalForQueue.bjjQueue = queue;
  return queue;
}

export interface JobPayload {
  jobId: string;
  userId: string;
  onlyFailed?: boolean;
}
