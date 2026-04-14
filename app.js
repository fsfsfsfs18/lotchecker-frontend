const OCR_ENDPOINT = "https://lotchecker-serverless.vercel.app/api/ocr";

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("cropperContainer");
const cropFrame = document.getElementById("cropFrame");
const cropBtn = document.getElementById("cropBtn");
const ocrOutput = document.getElementById("ocrOutput");

let img = new Image();
let scale = 1;
let minScale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastX = 0;
let lastY = 0;

// ------------------------------
// 1. Foto laden
// ------------------------------
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img.src = url;

  img.onload = () => {
    setupCanvas();
    draw();
  };
});

// ------------------------------
// 2. Canvas setup
// ------------------------------
function setupCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  const scaleX = canvas.width / img.width;
  const scaleY = canvas.height / img.height;

  minScale = Math.max(scaleX, scaleY);
  scale = minScale;

  offsetX = (canvas.width - img.width * scale) / 2;
  offsetY = (canvas.height - img.height * scale) / 2;
}

// ------------------------------
// 3. Teken functie
// ------------------------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    img,
    offsetX,
    offsetY,
    img.width * scale,
    img.height * scale
  );
}

// ------------------------------
// 4. Pan (slepen)
// ------------------------------
container.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

container.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;

  offsetX += dx;
  offsetY += dy;

  lastX = e.clientX;
  lastY = e.clientY;

  draw();
});

container.addEventListener("mouseup", () => {
  isDragging = false;
});

// Touch
container.addEventListener("touchstart", (e) => {
  isDragging = true;
  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;
});

container.addEventListener("touchmove", (e) => {
  if (!isDragging) return;

  const dx = e.touches[0].clientX - lastX;
  const dy = e.touches[0].clientY - lastY;

  offsetX += dx;
  offsetY += dy;

  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;

  draw();
});

container.addEventListener("touchend", () => {
  isDragging = false;
});

// ------------------------------
// 5. Zoom (scroll + pinch)
// ------------------------------
container.addEventListener("wheel", (e) => {
  e.preventDefault();

  const zoomFactor = 1.1;
  const mouseX = e.clientX - container.getBoundingClientRect().left;
  const mouseY = e.clientY - container.getBoundingClientRect().top;

  const prevScale = scale;

  if (e.deltaY < 0) scale *= zoomFactor;
  else scale /= zoomFactor;

  if (scale < minScale) scale = minScale;

  offsetX = mouseX - ((mouseX - offsetX) * scale) / prevScale;
  offsetY = mouseY - ((mouseY - offsetY) * scale) / prevScale;

  draw();
});

// ------------------------------
// 6. Crop uitvoeren
// ------------------------------
cropBtn.addEventListener("click", () => {
  const rect = cropFrame.getBoundingClientRect();
  const cont = container.getBoundingClientRect();

  const cropX = rect.left - cont.left;
  const cropY = rect.top - cont.top;
  const cropW = rect.width;
  const cropH = rect.height;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = cropW;
  tempCanvas.height = cropH;
  const tctx = tempCanvas.getContext("2d");

  tctx.drawImage(
    canvas,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  tempCanvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append("image", blob);

    const response = await fetch(OCR_ENDPOINT, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    ocrOutput.value =
      data.lotNumber ||
      data.date ||
      data.rawText ||
      "Geen tekst gevonden";
  }, "image/jpeg", 0.95);
});