// --------------------------------------
// 1. OCR ENDPOINT (Vercel REST API)
// --------------------------------------
const OCR_ENDPOINT = "https://lotchecker-serverless.vercel.app/api/ocr";

async function googleVisionOCRFromBlob(blob) {
  const formData = new FormData();
  formData.append("image", blob);

  let response;
  try {
    response = await fetch(OCR_ENDPOINT, {
      method: "POST",
      body: formData
    });
  } catch (err) {
    console.error("FOUT: fetch naar backend mislukt:", err);
    return { rawText: "", lotNumber: "", date: "" };
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error("FOUT: kon JSON niet lezen:", err);
    return { rawText: "", lotNumber: "", date: "" };
  }

  console.log("OCR response data:", data);

  return {
    rawText: (data.rawText || "").trim(),
    lotNumber: data.lotNumber || "",
    date: data.date || ""
  };
}

// --------------------------------------
// 2. File upload OCR (Foto 1 & 2)
// --------------------------------------
document.getElementById("file1").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const ocr = await googleVisionOCRFromBlob(file);
  document.getElementById("output1").value = ocr.lotNumber || ocr.rawText;
});

document.getElementById("file2").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const ocr = await googleVisionOCRFromBlob(file);
  document.getElementById("output2").value = ocr.lotNumber || ocr.rawText;
});

// --------------------------------------
// 3. Vergelijking
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

// --------------------------------------
// 4. Live Camera + Scan-kader + lichte preprocessing
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
  } catch (err) {
    console.error("Kon camera niet starten:", err);
  }
}

startCamera();

captureBtn.addEventListener("click", () => {
  if (!video.videoWidth || !video.videoHeight) {
    console.warn("Camera nog niet klaar");
    return;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // zelfde verhouding als CSS: 60% breed, 25% hoog, gecentreerd
  const sx = vw * 0.2;
  const sy = vh * 0.375;
  const sw = vw * 0.6;
  const sh = vh * 0.25;

  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  // simpele preprocessing: grayscale + beetje extra contrast
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;
  const contrast = 1.4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let v = 0.299 * r + 0.587 * g + 0.114 * b;
    v = (v - 128) * contrast + 128;
    v = Math.max(0, Math.min(255, v));

    data[i] = data[i + 1] = data[i + 2] = v;
  }

  ctx.putImageData(imgData, 0, 0);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const ocr = await googleVisionOCRFromBlob(blob);
    liveOutput.value = ocr.lotNumber || ocr.rawText;
  }, "image/jpeg", 0.9);
});