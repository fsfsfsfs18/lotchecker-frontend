// --------------------------------------
// 1. OCR ENDPOINT (Vercel)
// --------------------------------------
const OCR_ENDPOINT = "https://lotchecker-serverless.vercel.app/api/ocr";

async function googleVisionOCRFromBlob(blob) {
  const formData = new FormData();
  formData.append("image", blob);

  const response = await fetch(OCR_ENDPOINT, {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  return (data.text || "").trim();
}

// --------------------------------------
// 2. Live Camera Setup (BACK CAMERA)
// --------------------------------------
const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const liveOutput = document.getElementById("liveOutput");

// Probeer eerst de achtercamera
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { exact: "environment" }
  }
})
.then(stream => {
  video.srcObject = stream;
})
.catch(err => {
  console.warn("Environment camera not available, using default camera:", err);

  // Fallback voor laptops of toestellen zonder achtercamera
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => video.srcObject = stream);
});

// Capture + OCR
captureBtn.addEventListener("click", async () => {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  canvas.toBlob(async (blob) => {
    const text = await googleVisionOCRFromBlob(blob);
    liveOutput.value = text;
  }, "image/jpeg");
});

// --------------------------------------
// 3. Foto 1 OCR
// --------------------------------------
document.getElementById("file1").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await googleVisionOCRFromBlob(file);
  document.getElementById("output1").value = text;
});

// --------------------------------------
// 4. Foto 2 OCR
// --------------------------------------
document.getElementById("file2").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await googleVisionOCRFromBlob(file);
  document.getElementById("output2").value = text;
});

// --------------------------------------
// 5. Vergelijking
// --------------------------------------
document.getElementById("compareBtn").addEventListener("click", () => {
  const t1 = document.getElementById("output1").value.trim();
  const t2 = document.getElementById("output2").value.trim();
  const result = document.getElementById("compareResult");

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