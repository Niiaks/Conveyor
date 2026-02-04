export const metadataValidator = (data: { name: string, size: number, type: string }) => {
    if (!data.name || !data.size || !data.type) throw new Error("Metadata missing");

    // Size check (5GB)
    if (data.size > 5 * 1024 * 1024 * 1024) throw new Error("File too large");

    // Extension + Path Traversal checks (Your existing logic is perfect here)
    if (data.name.includes("..") || !data.name.match(/^[a-zA-Z0-9._-]+$/)) {
        throw new Error("Invalid filename");
    }

    return true;
}

//rabbitmq check file-type