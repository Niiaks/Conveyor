import { uploadService } from "../service/upload.service";
import { Request, Response } from "express";
import { metadataValidator } from "../helper";

export const uploadController = async (req: Request, res: Response) => {
    const { userId, name, size, type } = req.body;

    if (!userId || !name || !size || !type) {
        return res.status(400).json({ error: "Missing required upload metadata" });
    }

    try {
        metadataValidator({ name, size, type });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }

    try {
        const result = await uploadService({
            originalName: name,
            userId: userId,
            mimeType: type,
            size: size,
        });
        res.status(200).json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to upload file" });
    }
}