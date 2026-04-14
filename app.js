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
// PREPROCESSING (veilige versie)
// ------------------------------
ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

// Geen preprocessing — Vision werkt beter met originele pixels
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