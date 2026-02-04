import { Request, Response } from "express";
import { produce } from "../job";

const QUEUENAME = "validation";

export const notifyController = async (req: Request, res: Response) => {
    const { fileId, s3Key } = req.body;

    if (!fileId || !s3Key) {
        return res.status(400).json({ error: "Missing fileId or s3Key" });
    }

    try {
        // Now that the client confirmed the upload is done, 
        // we can safely tell the worker to start validating.
        await produce(QUEUENAME, { id: fileId, s3Key: s3Key });

        res.status(200).json({ message: "Notification received, validation queued." });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to queue validation" });
    }
};
