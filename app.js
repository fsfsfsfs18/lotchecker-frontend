// --------------------------------------
// 1. OCR ENDPOINT (Vercel REST API)
// --------------------------------------
const OCR_ENDPOINT = "https://lotchecker-serverless.vercel.app/api/ocr";

async function googleVisionOCRFromBlob(blob) {
  console.log("OCR wordt aangeroepen met blob:", blob);

  const formData = new FormData();
  formData.append("image", blob);

  let response;
  try {
    response = await fetch(OCR_ENDPOINT, {
      method: "POST",
      body: formData
    });
  } catch (err) {
    console.error("FOUT: fetch naar Vercel mislukt:", err);
    return "";
  }

  console.log("HTTP status:", response.status);

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error("FOUT: kon JSON niet lezen:", err);
    return "";
  }

  console.log("OCR response data:", data);

  return (data.text || "").trim();
}

// --------------------------------------
// 2. Live Camera Setup (BACK CAMERA)
// --------------------------------------
const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const liveOutput = document.getElementById("liveOutput");

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;
    console.log("Achtercamera gestart");
  } catch (err) {
    console.warn("Achtercamera mislukt, fallback naar standaard camera:", err);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    console.log("Fallback camera gestart");
  }
}

startCamera();

// --------------------------------------
// 3. Capture + OCR (Live Camera)
// --------------------------------------
captureBtn.addEventListener("click", async () => {
  if (!video.videoWidth || !video.videoHeight) {
    console.warn("Camera nog niet klaar");
    return;
  }

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  canvas.toBlob(async (blob) => {
    console.log("Blob gemaakt van camera:", blob);

    const text = await googleVisionOCRFromBlob(blob);
    console.log("OCR resultaat (live):", text);

    liveOutput.value = text;
  }, "image/jpeg");
});

// --------------------------------------
// 4. Foto 1 OCR
// --------------------------------------
document.getElementById("file1").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log("Foto 1 upload:", file);

  const text = await googleVisionOCRFromBlob(file);
  console.log("OCR resultaat foto 1:", text);

  document.getElementById("output1").value = text;
});

// --------------------------------------
// 5. Foto 2 OCR
// --------------------------------------
document.getElementById("file2").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log("Foto 2 upload:", file);

  const text = await googleVisionOCRFromBlob(file);
  console.log("OCR resultaat foto 2:", text);

  document.getElementById("output2").value = text;
});

// --------------------------------------
// 6. Vergelijking
// --------------------------------------
document.getElementById("compareBtn").addEventListener("click", () => {
  const t1 = document.getElementById("output1").value.trim();
  const t2 = document.getElementById("output2").value.trim();
  const result = document.getElementById("compareResult");

  console.log("Vergelijking:", t1, t2);

  if (!t1 || !t2) {
    result.innerHTML = "<b>Beide velden moeten tekst bevatten.</b>";
    return;
  }

  if (t1 === t2) {
    result.innerHTML = "<span style='color:green;font-weight:bold;'>✔ Lotnummers zijn gelijk</span>";
  } else {
    result.innerHTML = "<span style='color:red;font-weight:bold;'>✘ Lotnummers verschillen</span>";
  }
});