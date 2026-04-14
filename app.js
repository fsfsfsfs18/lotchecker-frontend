const OCR_ENDPOINT = "https://lotchecker-serverless.vercel.app/api/ocr";

const fileInput = document.getElementById("fileInput");
const uploadedImage = document.getElementById("uploadedImage");
const imageContainer = document.getElementById("imageContainer");
const cropBox = document.getElementById("cropBox");
const cropBtn = document.getElementById("cropBtn");
const ocrOutput = document.getElementById("ocrOutput");

let startX, startY, endX, endY;
let isDragging = false;

// ------------------------------
// 1. Foto laden
// ------------------------------
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  uploadedImage.src = url;
  imageContainer.style.display = "block";
});

// ------------------------------
// 2. Crop-kader tekenen
// ------------------------------
imageContainer.addEventListener("mousedown", (e) => {
  isDragging = true;

  const rect = imageContainer.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  cropBox.style.left = startX + "px";
  cropBox.style.top = startY + "px";
  cropBox.style.width = "0px";
  cropBox.style.height = "0px";
  cropBox.style.display = "block";
});

imageContainer.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const rect = imageContainer.getBoundingClientRect();
  endX = e.clientX - rect.left;
  endY = e.clientY - rect.top;

  const w = endX - startX;
  const h = endY - startY;

  cropBox.style.width = Math.abs(w) + "px";
  cropBox.style.height = Math.abs(h) + "px";
  cropBox.style.left = (w < 0 ? endX : startX) + "px";
  cropBox.style.top = (h < 0 ? endY : startY) + "px";
});

imageContainer.addEventListener("mouseup", () => {
  isDragging = false;
});

// ------------------------------
// 3. Crop uitvoeren + PREPROCESSING + OCR
// ------------------------------
cropBtn.addEventListener("click", async () => {
  if (!uploadedImage.src) return;

  const img = uploadedImage;
  const rect = imageContainer.getBoundingClientRect();
  const cropRect = cropBox.getBoundingClientRect();

  // verhouding tussen scherm en echte foto
  const scaleX = img.naturalWidth / rect.width;
  const scaleY = img.naturalHeight / rect.height;

  const sx = (cropRect.left - rect.left) * scaleX;
  const sy = (cropRect.top - rect.top) * scaleY;
  const sw = cropRect.width * scaleX;
  const sh = cropRect.height * scaleY;

  // canvas maken
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // ------------------------------
  // PREPROCESSING
  // ------------------------------
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  const contrast = 1.5; // iets sterker dan vorige versie
  const sharpen = true;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // grayscale
    let v = 0.299 * r + 0.587 * g + 0.114 * b;

    // contrast
    v = (v - 128) * contrast + 128;
    v = Math.max(0, Math.min(255, v));

    data[i] = data[i + 1] = data[i + 2] = v;
  }

  // simpele sharpening kernel
  if (sharpen) {
    const w = sw;
    const h = sh;
    const copy = new Uint8ClampedArray(data);

    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let idx = (y * w + x) * 4;

        let sum = 0;
        let k = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const i2 = ((y + ky) * w + (x + kx)) * 4;
            sum += copy[i2] * kernel[k++];
          }
        }

        const v = Math.max(0, Math.min(255, sum));
        data[idx] = data[idx + 1] = data[idx + 2] = v;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // ------------------------------
  // OCR upload
  // ------------------------------
  canvas.toBlob(async (blob) => {
    if (!blob) return;

    const formData = new FormData();
    formData.append("image", blob);

    const response = await fetch(OCR_ENDPOINT, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    console.log("OCR:", data);

    ocrOutput.value =
      data.lotNumber ||
      data.date ||
      data.rawText ||
      "Geen tekst gevonden";
  }, "image/jpeg", 0.95);
});