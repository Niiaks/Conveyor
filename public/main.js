const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("status");
const logArea = document.getElementById("logArea");
const progressArea = document.getElementById("progressArea");

const userIdDisplay = document.getElementById("userIdDisplay");

let userId = localStorage.getItem("user_id");
if (!userId) {
  userId = "user_" + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("user_id", userId);
}
userIdDisplay.textContent = userId;

function addLog(msg, isCode = false) {
  const div = document.createElement(isCode ? "pre" : "p");
  div.textContent = msg;
  logArea.appendChild(div);
}

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Select a file first!");

  progressArea.style.display = "block";
  logArea.innerHTML = "";
  uploadBtn.disabled = true;

  try {
    statusText.textContent = "Requesting Presigned URL from API...";
    addLog(`1. Calling POST /api/v1/upload with userId: ${userId}`);

    const response = await fetch("http://localhost:3000/api/v1/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name: file.name,
        size: file.size,
        type: file.type,
      }),
    });
    const { url, file: fileRecord } = await response.json();

    addLog(`2. Got URL from API:`, true);

    statusText.textContent = "Uploading DIRECTLY to MinIO...";
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        progressBar.value = percent;
        statusText.textContent = `Direct Upload: ${Math.round(percent)}%`;
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        statusText.textContent = "Handoff: Notifying API...";
        addLog(`4. MinIO accepted file. Notifying API to start validation...`);

        const notifyRes = await fetch(
          "http://localhost:3000/api/v1/upload/notify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileId: fileRecord._id,
              s3Key: fileRecord.s3Key,
            }),
          },
        );

        if (notifyRes.ok) {
          statusText.textContent = "DONE! Validation has been queued.";
          addLog(`5. API confirmed: Validation job pushed to RabbitMQ.`);
        }
      } else {
        statusText.textContent = "Upload Failed!";
        addLog(`Error Status: ${xhr.status}`, true);
      }
      uploadBtn.disabled = false;
    };

    xhr.send(file);
  } catch (err) {
    statusText.textContent = "Connection Failed!";
    addLog(`Error: ${err.message}`);
    uploadBtn.disabled = false;
  }
});
