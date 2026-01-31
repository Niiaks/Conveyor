import { S3Client } from "@aws-sdk/client-s3";

const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;

if (!accessKey || !secretKey) {
  throw new Error("MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be defined");
}

export const minioClient = new S3Client({
  endpoint: process.env.MIN_IO_URL,
  region: "us-east-1",
  credentials: {
    accessKeyId: accessKey as string,
    secretAccessKey: secretKey as string,
  },
  forcePathStyle: true,
});
