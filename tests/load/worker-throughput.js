// Worker Throughput Benchmark
// This script tests the raw processing capacity of the validation and media processing workers

const fs = require("fs");
const amqp = require("amqplib");
const { performance } = require("perf_hooks");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://user:password@localhost:5672";
const NUM_MESSAGES = parseInt(process.env.NUM_MESSAGES) || 1000;
const QUEUE_NAME = process.env.QUEUE_NAME || "validation";

async function benchmarkWorkerThroughput() {
  console.log(`Queue: ${QUEUE_NAME}`);
  console.log(`Messages: ${NUM_MESSAGES}`);
  console.log(`Target: ${RABBITMQ_URL}\n`);

  let connection;
  let channel;

  try {
    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Ensure the queue exists
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log(`📤 Publishing ${NUM_MESSAGES} messages...`);
    const startPublish = performance.now();

    // Publish messages
    for (let i = 0; i < NUM_MESSAGES; i++) {
      const message = JSON.stringify({
        fileId: `test-file-${i}`,
        timestamp: Date.now(),
      });

      channel.sendToQueue(QUEUE_NAME, Buffer.from(message), {
        persistent: true,
      });

      if ((i + 1) % 100 === 0) {
        process.stdout.write(`\r   Published: ${i + 1}/${NUM_MESSAGES}`);
      }
    }

    const publishDuration = performance.now() - startPublish;
    console.log(
      `\n Published ${NUM_MESSAGES} messages in ${publishDuration.toFixed(2)}ms`,
    );
    console.log(
      `   Publishing Rate: ${(NUM_MESSAGES / (publishDuration / 1000)).toFixed(2)} msg/sec\n`,
    );

    // Get initial queue depth
    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    console.log(`Queue Depth: ${queueInfo.messageCount} messages\n`);

    console.log(`Waiting for workers to process messages...`);
    console.log(`   (Make sure your workers are running!)\n`);

    // Poll the queue until empty
    const startProcessing = performance.now();
    let lastMessageCount = queueInfo.messageCount;
    let checkCount = 0;

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second

      const currentQueueInfo = await channel.checkQueue(QUEUE_NAME);
      const currentCount = currentQueueInfo.messageCount;

      checkCount++;
      const elapsed = ((performance.now() - startProcessing) / 1000).toFixed(1);
      const processed = lastMessageCount - currentCount;
      const rate =
        processed > 0
          ? (processed / (checkCount === 1 ? 1 : 1)).toFixed(2)
          : "0.00";

      process.stdout.write(
        `\r   Remaining: ${currentCount} | Elapsed: ${elapsed}s | Rate: ~${rate} msg/sec`,
      );

      if (currentCount === 0) {
        break;
      }

      lastMessageCount = currentCount;

      // Timeout after 5 minutes
      if (checkCount > 300) {
        console.log(
          `\n\n⚠️  Timeout reached. Some messages may still be processing.`,
        );
        break;
      }
    }

    const processingDuration = performance.now() - startProcessing;
    console.log(
      `\n\nAll messages processed in ${(processingDuration / 1000).toFixed(2)}s`,
    );
    console.log(
      `   Processing Throughput: ${(NUM_MESSAGES / (processingDuration / 1000)).toFixed(2)} msg/sec\n`,
    );

    // Final summary
    console.log(`Summary`);

    console.log(`Total Messages: ${NUM_MESSAGES}`);
    console.log(
      `Total Time: ${((publishDuration + processingDuration) / 1000).toFixed(2)}s`,
    );
    console.log(
      `Average Throughput: ${(NUM_MESSAGES / ((publishDuration + processingDuration) / 1000)).toFixed(2)} msg/sec`,
    );
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Resume-ready metric
    const throughput = (
      NUM_MESSAGES /
      ((publishDuration + processingDuration) / 1000)
    ).toFixed(2);
    console.log(
      `   "Achieved ${throughput} messages/second throughput in RabbitMQ-based`,
    );
    console.log(
      `    asynchronous processing pipeline with ${QUEUE_NAME} workers"\n`,
    );
  } catch (error) {
    console.error("\nError:", error.message);
    process.exit(1);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
}

// Run the benchmark
benchmarkWorkerThroughput();
