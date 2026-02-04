import type { Message } from "./producer";
import { getConnection } from "./rabbitmq";

export const consume = async (queue: string, callback: (data: any) => Promise<void>) => {
    try {
        const connection = await getConnection();
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: true });
        channel.prefetch(1);

        channel.consume(queue, async (msg: any) => {
            if (msg !== null) {
                try {
                    // Parse binary Buffer to Object
                    const data = JSON.parse(msg.content.toString());

                    // Execute the worker logic (callback)
                    await callback(data);

                    // Acknowledge the message (RabbitMQ removes it from queue)
                    channel.ack(msg);
                } catch (err) {
                    console.log("Worker Error:", err);
                    // Re-queue the message if it failed so it can be retried later
                    channel.nack(msg, false, true);
                }
            }
        });
    } catch (error) {
        console.log(error);
    }
}
