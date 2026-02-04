import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// Custom metrics
const uploadInitiations = new Counter("upload_initiations");
const directUploads = new Counter("direct_uploads");
const notifications = new Counter("notifications");
const endToEndLatency = new Trend("end_to_end_latency");

// Simple test configuration - no strict thresholds
export const options = {
  stages: [
    { duration: "20s", target: 5 },
    { duration: "30s", target: 10 },
    { duration: "20s", target: 5 },
    { duration: "10s", target: 0 },
  ],
};

const API_URL = __ENV.API_URL || "http://localhost:3000/api/v1";

function generateImageMetadata() {
  return {
    userId: `user-${Math.floor(Math.random() * 1000)}`,
    name: `test-image-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`,
    type: "image/jpeg",
    size: Math.floor(Math.random() * 1000000) + 100000, // 100KB - 1MB (smaller for faster tests)
  };
}

function createMinimalJPEG() {
  const jpegHeader = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01,
  ]);
  const padding = new Uint8Array(1024 * 20); // 20KB
  const jpegFooter = new Uint8Array([0xff, 0xd9]);

  const result = new Uint8Array(
    jpegHeader.length + padding.length + jpegFooter.length,
  );
  result.set(jpegHeader, 0);
  result.set(padding, jpegHeader.length);
  result.set(jpegFooter, jpegHeader.length + padding.length);

  return result.buffer;
}

export default function () {
  const startTime = Date.now();
  const metadata = generateImageMetadata();

  // 1. Request presigned URL
  const uploadResponse = http.post(
    `${API_URL}/upload`,
    JSON.stringify(metadata),
    { headers: { "Content-Type": "application/json" } },
  );

  if (uploadResponse.status !== 200) {
    console.error(
      `Upload init failed: ${uploadResponse.status} - ${uploadResponse.body}`,
    );
    return;
  }

  uploadInitiations.add(1);

  const responseData = uploadResponse.json();
  const presignedUrl = responseData.presignedUrl;
  const fileId =
    responseData.file._id || responseData.file.id || responseData.fileId;

  if (!presignedUrl || !fileId) {
    console.error(`Missing presigned URL or fileId in response`);
    return;
  }

  // 2. Direct upload to MinIO
  const imageData = createMinimalJPEG();
  const directUploadResponse = http.put(presignedUrl, imageData, {
    headers: { "Content-Type": "image/jpeg" },
  });

  if (directUploadResponse.status !== 200) {
    console.error(`Direct upload failed: ${directUploadResponse.status}`);
    return;
  }

  directUploads.add(1);

  // 3. Notify completion
  const notifyResponse = http.post(
    `${API_URL}/upload/notify`,
    JSON.stringify({ fileId }),
    { headers: { "Content-Type": "application/json" } },
  );

  if (notifyResponse.status === 200) {
    notifications.add(1);
  }

  endToEndLatency.add(Date.now() - startTime);
  sleep(Math.random() + 0.5); // 0.5-1.5 seconds
}

export function handleSummary(data) {
  const summary = generateTextSummary(data);
  console.log(summary);
  return {
    stdout: summary,
    "summary.json": JSON.stringify(data, null, 2),
  };
}

function generateTextSummary(data) {
  let summary = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `Conveyor Stress Test Results\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (data.metrics.upload_initiations) {
    summary += ` Upload Initiations: ${data.metrics.upload_initiations.values.count}\n`;
  }
  if (data.metrics.direct_uploads) {
    summary += ` Direct Uploads: ${data.metrics.direct_uploads.values.count}\n`;
  }
  if (data.metrics.notifications) {
    summary += ` Notifications: ${data.metrics.notifications.values.count}\n`;
  }

  summary += `\n  Latency Metrics:\n`;
  if (data.metrics.end_to_end_latency) {
    summary += `   • Average: ${data.metrics.end_to_end_latency.values.avg.toFixed(2)}ms\n`;
    summary += `   • P95: ${data.metrics.end_to_end_latency.values["p(95)"].toFixed(2)}ms\n`;
    summary += `   • Max: ${data.metrics.end_to_end_latency.values.max.toFixed(2)}ms\n`;
  }

  summary += `\nHTTP Performance:\n`;
  if (data.metrics.http_req_duration) {
    summary += `   • Average: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `   • P95: ${data.metrics.http_req_duration.values["p(95)"].toFixed(2)}ms\n`;
  }
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(
      2,
    );
    const successRate = (100 - parseFloat(failRate)).toFixed(2);
    summary += `   • Success Rate: ${successRate}%\n`;
  }
  if (data.metrics.http_reqs) {
    summary += `   • Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  }

  summary += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // Calculate some resume metrics
  const uploads = data.metrics.upload_initiations?.values.count || 0;
  const successRate = data.metrics.http_req_failed
    ? (100 - data.metrics.http_req_failed.values.rate * 100).toFixed(2)
    : "100.00";
  const p95Latency =
    data.metrics.end_to_end_latency?.values["p(95)"]?.toFixed(0) || "N/A";

  summary += `   • Processed ${uploads} concurrent uploads\n`;
  summary += `   • Achieved ${successRate}% success rate\n`;
  summary += `   • P95 latency: ${p95Latency}ms\n`;
  summary += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return summary;
}
