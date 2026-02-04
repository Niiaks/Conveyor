import amqp from "amqplib";

let connection: any;
export const getConnection = async () => {
    try {
        if (!connection) {
            connection = await amqp.connect(`amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@localhost:5672`);
        }
        return connection;
    } catch (error) {
        console.log(error);
    }
}