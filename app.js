const OCR_ENDPOINT = "https://lotchecker-serverless.vercel.app/api/ocr";

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("cropperContainer");
const cropFrame = document.getElementById("cropFrame");
const cropBtn = document.getElementById("cropBtn");
const ocrOutput = document.getElementById("ocrOutput");
const ocrModeInputs = document.querySelectorAll('input[name="ocrMode"]');

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

container.addEventListener("mouseleave", () => {
  isDragging = false;
});

// Touch
container.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    isDragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }
});

container.addEventListener("touchmove", (e) => {
  if (!isDragging || e.touches.length !== 1) return;

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
// 5. Zoom (scroll)
// ------------------------------
container.addEventListener("wheel", (e) => {
  e.preventDefault();

  const zoomFactor = 1.1;
  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const prevScale = scale;

  if (e.deltaY < 0) scale *= zoomFactor;
  else scale /= zoomFactor;

  if (scale < minScale) scale = minScale;

  offsetX = mouseX - ((mouseX - offsetX) * scale) / prevScale;
  offsetY = mouseY - ((mouseY - offsetY) * scale) / prevScale;

  draw();
}, { passive: false });

// ------------------------------
// 6. OCR modus ophalen
// ------------------------------
function getOcrMode() {
  let mode = "normal";
  ocrModeInputs.forEach((input) => {
    if (input.checked) mode = input.value;
  });
  return mode;
}

// ------------------------------
// 7. Auto-detect dot-matrix (simpele heuristiek)
// ------------------------------
function isLikelyDotMatrix(imgData) {
  const { data, width, height } = imgData;

  // Neem een sample raster (niet alles, voor snelheid)
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const v = data[idx]; // grayscale of nog RGB, maakt niet uit voor variatie
      sum += v;
      sumSq += v * v;
      count++;
    }
  }

  if (count === 0) return false;

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  const stdDev = Math.sqrt(variance);

  // Dot-matrix: vaak middelgrijs met relatief hoge micro-variatie
  // Dit is een heuristiek, mag je later tweaken
  return mean > 80 && mean < 200 && stdDev > 25;
}

// ------------------------------
// 8. Dot-matrix reconstructiefilter
// ------------------------------
function applyDotMatrixFilter(tctx, cropW, cropH) {
  const imgData = tctx.getImageData(0, 0, cropW, cropH);
  const data = imgData.data;

  // 1. Grayscale
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  // 2. Dilation
  function dilate() {
    const copy = new Uint8ClampedArray(data);
    for (let y = 1; y < cropH - 1; y++) {
      for (let x = 1; x < cropW - 1; x++) {
        let max = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * cropW + (x + dx)) * 4;
            max = Math.max(max, copy[idx]);
          }
        }
        const idx = (y * cropW + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = max;
      }
    }
  }

  // 3. Erosion
  function erode() {
    const copy = new Uint8ClampedArray(data);
    for (let y = 1; y < cropH - 1; y++) {
      for (let x = 1; x < cropW - 1; x++) {
        let min = 255;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * cropW + (x + dx)) * 4;
            min = Math.min(min, copy[idx]);
          }
        }
        const idx = (y * cropW + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = min;
      }
    }
  }

  // 4. Closing (dilate -> erode)
  dilate();
  erode();

  // 5. Contrast verhogen
  for (let i = 0; i < data.length; i += 4) {
    let v = data[i];
    v = (v - 128) * 1.4 + 128;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  tctx.putImageData(imgData, 0, 0);
}

// ------------------------------
// 9. Crop uitvoeren + Vision aanroepen
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

  // Teken het geselecteerde gebied van het hoofdcanvas
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

  const mode = getOcrMode();

  if (mode === "dot") {
    // Geforceerd dot-matrix filter
    applyDotMatrixFilter(tctx, cropW, cropH);
  } else if (mode === "auto") {
    // Auto-detectie: eerst imageData ophalen
    const imgData = tctx.getImageData(0, 0, cropW, cropH);
    if (isLikelyDotMatrix(imgData)) {
      applyDotMatrixFilter(tctx, cropW, cropH);
    }
  }
  // mode === "normal" => geen extra filter

  tempCanvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append("image", blob);

    try {
      const response = await fetch(OCR_ENDPOINT, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      ocrOutput.value =
        data.lotNumber ||
        data.date ||
        data.rawText ||
        JSON.stringify(data, null, 2) ||
        "Geen tekst gevonden";
    } catch (err) {
      ocrOutput.value = "Fout bij OCR-aanvraag: " + err.message;
    }
  }, "image/jpeg", 0.95);
});