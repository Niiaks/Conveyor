import "dotenv/config";
import { connectDB } from "../src/database";
import { File } from "../src/model/file.model";
import { consume } from "../src/job";
import { minioClient } from "../src/lib/minioClient";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const QUEUENAME = "media_processing";

// Connect to MongoDB
connectDB();

console.log(`[*] Media Processing Worker (Sharp) started. Waiting for tasks in ${QUEUENAME}...`);

consume(QUEUENAME, async (data: any) => {
    const { id, s3Key } = data;

    const file = await File.findById(id);
    if (!file) {
        console.log(`[Error] File ${id} not found.`);
        return;
    }

    try {
        console.log(`[Processing] Downloading file: ${s3Key}`);

        const response = await minioClient.send(new GetObjectCommand({
            Bucket: "buck1",
            Key: s3Key
        }));

        const bodyBytes = await response.Body?.transformToByteArray();
        if (!bodyBytes) throw new Error("Could not download file content");

        const inputBuffer = Buffer.from(bodyBytes);

        console.log(`[Processing] Generating image versions for ${id}...`);

        // Thumbnail: 200px wide
        const thumbBuffer = await sharp(inputBuffer)
            .resize(200)
            .jpeg({ quality: 70 })
            .toBuffer();

        // Optimized: Max 1280px wide
        const optimizedBuffer = await sharp(inputBuffer)
            .resize({ width: 1280, withoutEnlargement: true })
            .jpeg({ quality: 85, mozjpeg: true })
            .toBuffer();

        const thumbKey = `processed/${id}/thumb.jpg`;
        const optimizedKey = `processed/${id}/optimized.jpg`;

        await Promise.all([
            minioClient.send(new PutObjectCommand({
                Bucket: "buck1",
                Key: thumbKey,
                Body: thumbBuffer,
                ContentType: "image/jpeg"
            })),
            minioClient.send(new PutObjectCommand({
                Bucket: "buck1",
                Key: optimizedKey,
                Body: optimizedBuffer,
                ContentType: "image/jpeg"
            }))
        ]);

        file.status = "COMPLETED";
        file.versions = {
            thumbnail: thumbKey,
            medium: optimizedKey,
            optimized: optimizedKey
        };

        await file.save();

        console.log(`[Success] File ${id} processed and versions uploaded!`);

    } catch (err) {
        console.error(`[Fatal] Processing failed for ${id}:`, (err as Error).message);
        file.status = "FAILED";
        file.error = (err as Error).message;
        await file.save();
    }
});
