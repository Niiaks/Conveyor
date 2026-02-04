import { getConnection } from "./rabbitmq";

export type Message = {
    id: string,
    s3Key: string,
}

export const produce = async (queue: string, message: Message) => {
    try {
        const connection = await getConnection();
        const channel = await connection.createChannel();
        channel.assertQueue(queue, { durable: true });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    } catch (error) {
        console.log(error);
    }
}