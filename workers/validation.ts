import "dotenv/config";
import { connectDB } from "../src/database";
import { File } from "../src/model/file.model";
import { consume, produce } from "../src/job";
import { minioClient } from "../src/lib/minioClient";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";

const VALIDATION_QUEUE = "validation";
const PROCESSING_QUEUE = "media_processing";

// Connect to MongoDB
connectDB();

console.log(`[*] Validation Worker started. Waiting for messages in ${VALIDATION_QUEUE}...`);

consume(VALIDATION_QUEUE, async (data: any) => {
    const { id, s3Key } = data;

    const file = await File.findById(id);
    if (!file) {
        console.log(`[Error] File ${id} not found.`);
        return;
    }

    try {
        console.log(`[Validation] Downloading headers for: ${s3Key}`);

        // Get ONLY the first 4KB of the file
        const response = await minioClient.send(new GetObjectCommand({
            Bucket: "buck1",
            Key: s3Key,
            Range: "bytes=0-4095"
        }));

        const bytes = await response.Body?.transformToByteArray();
        if (!bytes) throw new Error("Could not read file headers from MinIO");

        // Check Magic Bytes
        const detected = await fileTypeFromBuffer(Buffer.from(bytes));

        console.log(`[Validation] User claims: ${file.mimeType}, Detected: ${detected?.mime || 'unknown'}`);

        // detected type matches user claim
        const claimedCategory = file.mimeType?.split('/')[0];
        const detectedCategory = detected?.mime?.split('/')[0];

        if (!detected || claimedCategory !== detectedCategory) {
            throw new Error(`Security Alert: File type mismatch! Detected ${detected?.mime} but claimed ${file.mimeType}`);
        }

        // Success update status and move to processing
        file.status = "PROCESSING";
        await file.save();

        console.log(`[Success] ${id} is valid. Handing off to media_processing...`);
        await produce(PROCESSING_QUEUE, { id, s3Key });

    } catch (err) {
        console.error(`[Failed] Validation failed for ${id}:`, (err as Error).message);
        file.status = "FAILED";
        file.error = (err as Error).message;
        await file.save();
    }
});

