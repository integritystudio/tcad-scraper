const { Queue, Worker } = require('bullmq');

const connection = {
  host: 'localhost',
  port: 6379,
};

const myQueue = new Queue('my-queue', { connection });

// Add jobs
await myQueue.add('my-job', { foo: 'bar' });

// Process jobs
const worker = new Worker('my-queue', async job => {
  console.log('Processing:', job.data);
  // Your job logic here
}, { connection });
