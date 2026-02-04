import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';

const uploadInitiations = new Counter('upload_initiations');
const directUploads = new Counter('direct_uploads');
const notifications = new Counter('notifications');
const endToEndLatency = new Trend('end_to_end_latency');

export const options = {
    stages: [
        { duration: '30s', target: 10 },   // Ramp-up to 10 users
        { duration: '1m', target: 50 },    // Ramp-up to 50 users
        { duration: '2m', target: 100 },   // Sustained load at 100 concurrent users
        { duration: '1m', target: 200 },   // Peak stress test at 200 users
        { duration: '30s', target: 0 },    // Ramp-down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
        http_req_failed: ['rate<0.05'],    // Less than 5% failure rate
    },
};

const API_URL = __ENV.API_URL || 'http://localhost:3000/api/v1';

// Generate random image metadata
function generateImageMetadata() {
    return {
        userId: `user-${Math.floor(Math.random() * 1000)}`,
        name: `test-image-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`,
        type: 'image/jpeg',
        size: Math.floor(Math.random() * 5000000) + 100000, // 100KB - 5MB
    };
}

// Create a minimal JPEG binary (for testing purposes)
function createMinimalJPEG() {
    // JPEG header + minimal valid structure
    const jpegHeader = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    ]);

    // Pad with zeros to simulate a small image
    const padding = new Uint8Array(1024 * 50); // 50KB

    // JPEG footer
    const jpegFooter = new Uint8Array([0xFF, 0xD9]);

    const result = new Uint8Array(jpegHeader.length + padding.length + jpegFooter.length);
    result.set(jpegHeader, 0);
    result.set(padding, jpegHeader.length);
    result.set(jpegFooter, jpegHeader.length + padding.length);

    return result.buffer;
}

export default function () {
    const startTime = Date.now();
    const metadata = generateImageMetadata();

    // Request presigned URL from API
    const uploadResponse = http.post(
        `${API_URL}/upload`,
        JSON.stringify(metadata),
        {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'InitiateUpload' },
        }
    );

    const uploadCheck = check(uploadResponse, {
        'upload initiation successful': (r) => r.status === 200,
        'received presigned URL': (r) => r.json('presignedUrl') !== undefined,
        'received fileId': (r) => r.json('fileId') !== undefined,
    });

    if (!uploadCheck) {
        console.error(`Upload initiation failed: ${uploadResponse.status}`);
        return;
    }

    uploadInitiations.add(1);
    const { presignedUrl, fileId } = uploadResponse.json();

    // Direct upload to MinIO (S3)
    const imageData = createMinimalJPEG();
    const directUploadResponse = http.put(presignedUrl, imageData, {
        headers: { 'Content-Type': 'image/jpeg' },
        tags: { name: 'DirectUpload' },
    });

    const directUploadCheck = check(directUploadResponse, {
        'direct upload successful': (r) => r.status === 200,
    });

    if (!directUploadCheck) {
        console.error(`Direct upload failed: ${directUploadResponse.status}`);
        return;
    }

    directUploads.add(1);

    // Notify API that upload is complete
    const notifyResponse = http.post(
        `${API_URL}/upload/notify`,
        JSON.stringify({ fileId }),
        {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'NotifyComplete' },
        }
    );

    const notifyCheck = check(notifyResponse, {
        'notification successful': (r) => r.status === 200,
    });

    if (notifyCheck) {
        notifications.add(1);
    }

    // Track end-to-end latency
    const totalLatency = Date.now() - startTime;
    endToEndLatency.add(totalLatency);

    // Small sleep to simulate realistic user behavior
    sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function handleSummary(data) {
    return {
        'summary.json': JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}

function textSummary(data, config) {
    const { indent = '', enableColors = false } = config;
    let summary = `\n${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `${indent}📊 Conveyor Stress Test Results\n`;
    summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (data.metrics.upload_initiations) {
        summary += `${indent}✅ Upload Initiations: ${data.metrics.upload_initiations.values.count}\n`;
    }
    if (data.metrics.direct_uploads) {
        summary += `${indent}✅ Direct Uploads: ${data.metrics.direct_uploads.values.count}\n`;
    }
    if (data.metrics.notifications) {
        summary += `${indent}✅ Notifications: ${data.metrics.notifications.values.count}\n`;
    }

    summary += `\n${indent}⏱️  Latency Metrics:\n`;
    if (data.metrics.end_to_end_latency) {
        summary += `${indent}   • Average: ${data.metrics.end_to_end_latency.values.avg.toFixed(2)}ms\n`;
        summary += `${indent}   • P95: ${data.metrics.end_to_end_latency.values['p(95)'].toFixed(2)}ms\n`;
        summary += `${indent}   • Max: ${data.metrics.end_to_end_latency.values.max.toFixed(2)}ms\n`;
    }

    summary += `\n${indent}🌐 HTTP Performance:\n`;
    if (data.metrics.http_req_duration) {
        summary += `${indent}   • Average: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
        summary += `${indent}   • P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    }
    if (data.metrics.http_req_failed) {
        const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
        summary += `${indent}   • Failure Rate: ${failRate}%\n`;
    }

    summary += `\n${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    return summary;
}
