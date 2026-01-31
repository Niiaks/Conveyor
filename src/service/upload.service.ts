import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { minioClient } from "../lib";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { File } from "../model/file.model";
import { v4 as uuidv4 } from 'uuid'
import { produce } from "../job";

type UploadDetails = {
    originalName: string,
    userId: string,
    size: number,
    mimeType: string,
}

const QUEUENAME = "validation"
export const uploadService = async (upload: UploadDetails) => {
    try {
        const fileId = uuidv4();
        const extension = upload.originalName.split('.').pop();
        const uniqueKey = `raw/${upload.userId}/${fileId}.${extension}`;

        const presignedUrl = await getSignedUrl(
            minioClient, new PutObjectCommand({
                Bucket: "buck1",
                Key: uniqueKey,
            }), {
            expiresIn: 60 * 60 * 24
        }
        )
        const file = new File({
            originalName: upload.originalName,
            userId: upload.userId,
            s3Key: uniqueKey,
            size: upload.size,
            mimeType: upload.mimeType,
        })
        await file.save()
        return { presignedUrl, file }
    } catch (error) {
        console.log(error)
    }
}