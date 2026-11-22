import * as THREE from 'three';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { GarmentProduct, PDF_CATALOG_PATH } from '../data/catalog';
import {
  createDefaultOverride,
  GarmentArtworkOverride,
  hasCustomizations,
} from './artworkStorage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface BakedGarmentAssets {
  pageNumber: number;
  frontTexture: THREE.CanvasTexture;
  backTexture: THREE.CanvasTexture;
  frontRoughnessMap: THREE.CanvasTexture;
  backRoughnessMap: THREE.CanvasTexture;
  fabricSolidTexture: THREE.CanvasTexture | null;
  sampledHex: string;
  washedEffect: boolean;
  frontThumbUrl: string;
  backThumbUrl: string;
}

export interface GarmentThumbPair {
  frontThumbUrl: string;
  backThumbUrl: string;
}

interface RawPdfPageExtract {
  pageCanvas: HTMLCanvasElement;
  sampledRgb: [number, number, number];
  sampledHex: string;
  pdfFrontThumbUrl: string;
  pdfBackThumbUrl: string;
}

let pdfDocumentPromise: Promise<pdfjsLib.PDFDocumentProxy> | null = null;
const rawPdfCache = new Map<number, RawPdfPageExtract>();
const inFlightPdf = new Map<number, Promise<RawPdfPageExtract>>();
const thumbCache = new Map<number, GarmentThumbPair>();
const inFlightThumb = new Map<number, Promise<GarmentThumbPair>>();

// Reusable offscreen cotton weave & vintage wash pattern canvases (computed once!)
let cachedWeaveTile: HTMLCanvasElement | null = null;
let cachedWashOverlay: HTMLCanvasElement | null = null;

// Queue PDF page renders sequentially so pdf.js worker never spikes memory
let renderQueue: Promise<void> = Promise.resolve();

function enqueuePdfTask<T>(fn: () => Promise<T>): Promise<T> {
  const result = renderQueue.then(fn, fn);
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function getPdfDocument(): Promise<pdfjsLib.PDFDocumentProxy> {
  if (!pdfDocumentPromise) {
    const loadingTask = pdfjsLib.getDocument({
      url: PDF_CATALOG_PATH,
      useSystemFonts: true,
    });
    pdfDocumentPromise = loadingTask.promise;
  }
  return pdfDocumentPromise;
}

async function renderPdfPageToCanvas(
  pageNumber: number,
  targetWidth: number,
): Promise<HTMLCanvasElement> {
  return enqueuePdfTask(async () => {
    const pdf = await getPdfDocument();
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context for PDF render.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    page.cleanup();
    return canvas;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
  ];
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode artwork image.'));
    img.src = src;
  });
}

/**
 * Generates a subtle tileable 280GSM jersey cotton knit micro-weave pattern
 * used with multiply/overlay blending ON TOP of printed artwork so prints look
 * authentically screen-printed into cotton fibers rather than glowing stickers.
 */
function getCottonWeaveTile(): HTMLCanvasElement {
  if (cachedWeaveTile) return cachedWeaveTile;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  let seed = 7919;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Interlocking vertical knit wales & angled jersey loops
      const wale = Math.sin((x / 3.2) * Math.PI * 2);
      const course = Math.sin(((y + (x % 3) * 0.5) / 4.2) * Math.PI * 2);
      const slub = (rand() - 0.5) * 20;
      const val = Math.max(
        180,
        Math.min(255, Math.round(234 + wale * 12 + course * 9 + slub * 0.45)),
      );
      const idx = (y * size + x) * 4;
      d[idx] = val;
      d[idx + 1] = val;
      d[idx + 2] = val;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedWeaveTile = canvas;
  return canvas;
}

/**
 * Generates a realistic pigment-dyed mineral/vintage wash mottling layer (512x512).
 */
function getVintageWashCanvas(): HTMLCanvasElement {
  if (cachedWashOverlay) return cachedWashOverlay;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(128, 128, 128)';
  ctx.fillRect(0, 0, size, size);

  let seed = 2026;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Large organic mineral wash clouds
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 18 + rand() * 72;
    const bright = rand() > 0.46;
    const shade = bright ? 168 : 92;
    const alpha = 0.045 + rand() * 0.05;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, `rgba(${shade}, ${shade}, ${shade}, ${alpha})`);
    grad.addColorStop(1, `rgba(${shade}, ${shade}, ${shade}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle sun-faded shoulder/chest highlight + darker seam edges
  const centerFade = ctx.createRadialGradient(
    size * 0.5,
    size * 0.38,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.58,
  );
  centerFade.addColorStop(0, 'rgba(182, 178, 174, 0.14)');
  centerFade.addColorStop(0.7, 'rgba(128, 128, 128, 0.0)');
  centerFade.addColorStop(1, 'rgba(72, 70, 68, 0.2)');
  ctx.fillStyle = centerFade;
  ctx.fillRect(0, 0, size, size);

  cachedWashOverlay = canvas;
  return canvas;
}

function paintCottonBase(
  ctx: CanvasRenderingContext2D,
  size: number,
  baseRgb: [number, number, number],
  washedEffect: boolean,
): void {
  const [br, bg, bb] = baseRgb;
  ctx.fillStyle = rgbToHex(br, bg, bb);
  ctx.fillRect(0, 0, size, size);

  if (washedEffect) {
    const wash = getVintageWashCanvas();
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.65;
    ctx.drawImage(wash, 0, 0, size, size);

    // Subtle chalky pigment lift for dark washed garments
    const lum = (br + bg + bb) / 3;
    if (lum < 90) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.09;
      ctx.drawImage(wash, 0, 0, size, size);
    }
    ctx.restore();
  }

  // Fine heavyweight jersey knit weave across bare fabric
  const weavePattern = ctx.createPattern(getCottonWeaveTile(), 'repeat');
  if (weavePattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = weavePattern;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }
}

function applyScreenPrintFabricIntegration(
  ctx: CanvasRenderingContext2D,
  size: number,
  washedEffect: boolean,
): void {
  const weavePattern = ctx.createPattern(getCottonWeaveTile(), 'repeat');
  if (weavePattern) {
    // Multiply cotton weave ON TOP of printed artwork so fabric grain shows through ink
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = washedEffect ? 0.32 : 0.22;
    ctx.fillStyle = weavePattern;
    ctx.fillRect(0, 0, size, size);

    // Gentle highlight texture over ink so ink catches ambient sheen like real plastisol/discharge
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = weavePattern;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  if (washedEffect) {
    const wash = getVintageWashCanvas();
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.38;
    ctx.drawImage(wash, 0, 0, size, size);
    ctx.restore();
  }
}

function sampleGarmentBaseRgb(
  pageCanvas: HTMLCanvasElement,
  fallbackHex: string,
  baseColor: GarmentProduct['baseColor'],
): [number, number, number] {
  const ctx = pageCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return hexToRgb(fallbackHex);

  const w = pageCanvas.width;
  const h = pageCanvas.height;
  const sx = Math.round(w * 0.345);
  const sy = Math.round(h * 0.775);
  const sw = Math.max(8, Math.round(w * 0.025));
  const sh = Math.max(8, Math.round(h * 0.025));
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  }

  if (count === 0) return hexToRgb(fallbackHex);

  let r = rSum / count;
  let g = gSum / count;
  let b = bSum / count;

  if (baseColor === 'black') {
    r = Math.min(r, 22);
    g = Math.min(g, 22);
    b = Math.min(b, 24);
  } else if (baseColor === 'white') {
    r = Math.max(r, 236);
    g = Math.max(g, 236);
    b = Math.max(b, 234);
  }

  return [r, g, b];
}

function extractFlatLayThumb(
  pageCanvas: HTMLCanvasElement,
  side: 'front' | 'back',
  baseColor: GarmentProduct['baseColor'],
  outSize = 512,
): string {
  const pw = pageCanvas.width;
  const ph = pageCanvas.height;

  const rx = side === 'front' ? 0.015 : 0.515;
  const rw = 0.47;
  const ry = 0.135;
  const rh = 0.725;

  const sx = Math.round(pw * rx);
  const sy = Math.round(ph * ry);
  const sw = Math.round(pw * rw);
  const sh = Math.round(ph * rh);

  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  const aspect = sw / sh;
  const pad = Math.round(outSize * 0.04);
  const avail = outSize - pad * 2;
  let dw = avail;
  let dh = avail / aspect;
  if (dh > avail) {
    dh = avail;
    dw = avail * aspect;
  }
  const dx = Math.round((outSize - dw) / 2);
  const dy = Math.round((outSize - dh) / 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.drawImage(pageCanvas, sx, sy, sw, sh, dx, dy, dw, dh);

  const img = ctx.getImageData(0, 0, outSize, outSize);
  const data = img.data;
  const visited = new Uint8Array(outSize * outSize);
  const threshold = baseColor === 'white' ? 249 : 238;

  const queue = new Int32Array(outSize * outSize);
  let head = 0;
  let tail = 0;

  const trySeed = (x: number, y: number) => {
    const idx = y * outSize + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (data[p] >= threshold && data[p + 1] >= threshold && data[p + 2] >= threshold) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < outSize; x++) {
    trySeed(x, 0);
    trySeed(x, outSize - 1);
  }
  for (let y = 0; y < outSize; y++) {
    trySeed(0, y);
    trySeed(outSize - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const p = idx * 4;
    data[p + 3] = 0;

    const x = idx % outSize;
    const y = (idx - x) / outSize;

    if (x > 0) trySeed(x - 1, y);
    if (x < outSize - 1) trySeed(x + 1, y);
    if (y > 0) trySeed(x, y - 1);
    if (y < outSize - 1) trySeed(x, y + 1);
  }

  for (let y = 1; y < outSize - 1; y++) {
    for (let x = 1; x < outSize - 1; x++) {
      const idx = y * outSize + x;
      if (visited[idx]) continue;
      const p = idx * 4;
      const neighborsCleared =
        visited[idx - 1] +
        visited[idx + 1] +
        visited[idx - outSize] +
        visited[idx + outSize];
      if (neighborsCleared > 0) {
        const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
        if (lum > threshold - 18) {
          data[p + 3] = Math.round(data[p + 3] * 0.45);
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

async function getRawPdfPage(garment: GarmentProduct): Promise<RawPdfPageExtract> {
  const cached = rawPdfCache.get(garment.pageNumber);
  if (cached) return cached;

  const existing = inFlightPdf.get(garment.pageNumber);
  if (existing) return existing;

  const task = (async () => {
    const pageCanvas = await renderPdfPageToCanvas(garment.pageNumber, 2200);
    const sampledRgb = sampleGarmentBaseRgb(
      pageCanvas,
      garment.baseHex,
      garment.baseColor,
    );
    const sampledHex = rgbToHex(sampledRgb[0], sampledRgb[1], sampledRgb[2]);
    const pdfFrontThumbUrl = extractFlatLayThumb(
      pageCanvas,
      'front',
      garment.baseColor,
      512,
    );
    const pdfBackThumbUrl = extractFlatLayThumb(
      pageCanvas,
      'back',
      garment.baseColor,
      512,
    );
    thumbCache.set(garment.pageNumber, {
      frontThumbUrl: pdfFrontThumbUrl,
      backThumbUrl: pdfBackThumbUrl,
    });

    const extract: RawPdfPageExtract = {
      pageCanvas,
      sampledRgb,
      sampledHex,
      pdfFrontThumbUrl,
      pdfBackThumbUrl,
    };
    rawPdfCache.set(garment.pageNumber, extract);
    inFlightPdf.delete(garment.pageNumber);
    return extract;
  })();

  inFlightPdf.set(garment.pageNumber, task);
  return task;
}

/**
 * Generates a realistic 2D flat-lay thumbnail silhouette reflecting custom uploaded PNG
 * artwork, custom base color, and washed effect so the 3D Showroom Ring frames,
 * Collection Drawer, Lookbook, and Bag stay 100% synchronized.
 */
async function renderCustomFlatLayThumb(
  side: 'front' | 'back',
  baseRgb: [number, number, number],
  washedEffect: boolean,
  customPngUrl: string | null,
  scale: number,
  offsetY: number,
  fallbackPdfThumbUrl: string,
  hasAnyColorOrWashChange: boolean,
): Promise<string> {
  if (!customPngUrl && !hasAnyColorOrWashChange && Math.abs(scale - 1) < 0.01 && Math.abs(offsetY) < 0.01) {
    return fallbackPdfThumbUrl;
  }

  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw crisp boxy oversized streetwear T-shirt silhouette path
  ctx.save();
  ctx.beginPath();
  // Collar left -> shoulder left -> left sleeve outer -> cuff -> underarm -> waist hem -> right side -> collar right
  ctx.moveTo(size * 0.39, size * 0.13);
  ctx.lineTo(size * 0.25, size * 0.17);
  ctx.lineTo(size * 0.05, size * 0.38);
  ctx.lineTo(size * 0.14, size * 0.53);
  ctx.lineTo(size * 0.25, size * 0.45);
  ctx.lineTo(size * 0.25, size * 0.87);
  ctx.lineTo(size * 0.75, size * 0.87);
  ctx.lineTo(size * 0.75, size * 0.45);
  ctx.lineTo(size * 0.86, size * 0.53);
  ctx.lineTo(size * 0.95, size * 0.38);
  ctx.lineTo(size * 0.75, size * 0.17);
  ctx.lineTo(size * 0.61, size * 0.13);
  // Crewneck curve
  ctx.quadraticCurveTo(
    size * 0.5,
    side === 'front' ? size * 0.23 : size * 0.17,
    size * 0.39,
    size * 0.13,
  );
  ctx.closePath();
  ctx.clip();

  paintCottonBase(ctx, size, baseRgb, washedEffect);

  // Subtle studio fold shading across silhouette
  const shadeGrad = ctx.createLinearGradient(0, 0, size, 0);
  shadeGrad.addColorStop(0, 'rgba(0,0,0,0.22)');
  shadeGrad.addColorStop(0.28, 'rgba(255,255,255,0.03)');
  shadeGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  shadeGrad.addColorStop(0.72, 'rgba(255,255,255,0.02)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, 0, size, size);

  // Draw custom uploaded PNG inside the flat chest/back torso print zone
  if (customPngUrl) {
    try {
      const img = await loadHtmlImage(customPngUrl);
      const zoneW = size * 0.41 * scale;
      const zoneH = size * 0.52 * scale;
      const imgAspect = img.width / Math.max(1, img.height);
      let dw = zoneW;
      let dh = dw / imgAspect;
      if (dh > zoneH) {
        dh = zoneH;
        dw = dh * imgAspect;
      }
      const cx = size * 0.5;
      const cy = size * (side === 'front' ? 0.46 : 0.44) + offsetY * size * 0.45;
      ctx.save();
      ctx.globalAlpha = washedEffect ? 0.88 : 0.96;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    } catch {
      // Ignore bad image
    }
  } else if (fallbackPdfThumbUrl) {
    // Fallback: composite PDF graphic subtly when only base color/wash changed
    try {
      const fallbackImg = await loadHtmlImage(fallbackPdfThumbUrl);
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(fallbackImg, 0, 0, size, size);
      ctx.restore();
    } catch {
      // Ignore
    }
  }

  applyScreenPrintFabricIntegration(ctx, size, washedEffect);

  // Subtle ribbed crewneck shadow ring
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(size * 0.39, size * 0.13);
  ctx.quadraticCurveTo(
    size * 0.5,
    side === 'front' ? size * 0.23 : size * 0.17,
    size * 0.61,
    size * 0.13,
  );
  ctx.stroke();

  ctx.restore();
  return canvas.toDataURL('image/png');
}

/**
 * Generates a matching washed/cotton texture for sleeves, collar, and waist hem
 * so the whole 3D garment shares unified fabric grain & vintage wash tone.
 */
function bakeSolidFabricTexture(
  baseRgb: [number, number, number],
  washedEffect: boolean,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  paintCottonBase(ctx, size, baseRgb, washedEffect);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Bakes a 1024x1024 front-chest or back-torso PBR albedo map + calibrated 512x512 roughness map.
 * - Keeps artwork strictly inside the safe flat torso UV zone (never stretches onto sleeves or collar).
 * - Blends cotton weave & vintage wash ON TOP of the artwork so prints look authentically screen-printed.
 */
async function bakeTorsoTextures(
  extract: RawPdfPageExtract,
  side: 'front' | 'back',
  garment: GarmentProduct,
  baseRgb: [number, number, number],
  override: GarmentArtworkOverride,
  maxAnisotropy: number,
): Promise<{ albedo: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture }> {
  const size = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d', { willReadFrequently: true })!;

  const customPng =
    side === 'front' ? override.frontPngDataUrl : override.backPngDataUrl;
  const printScale = side === 'front' ? override.frontScale : override.backScale;
  const printOffsetY =
    side === 'front' ? override.frontOffsetY : override.backOffsetY;

  // 1. Paint heavyweight cotton base (with optional washed/vintage mineral mottling)
  paintCottonBase(ctx, size, baseRgb, override.washedEffect);

  // Capture base fabric pixels BEFORE artwork for accurate ink-vs-fabric roughness masking
  const baseSnapshot = ctx.getImageData(0, 0, size, size).data;

  // Safe flat chest/back printable bounds (safely inset from collar dip, shoulders, and side seams!)
  const safeLeft = Math.round(size * 0.085);
  const safeRight = Math.round(size * 0.915);
  const safeTop = Math.round(size * (side === 'front' ? 0.145 : 0.105));
  const safeBottom = Math.round(size * 0.935);
  const safeW = safeRight - safeLeft;
  const safeH = safeBottom - safeTop;

  if (customPng) {
    // 2A. Custom Uploaded Transparent PNG Print
    const img = await loadHtmlImage(customPng);
    const maxBoxW = safeW * 0.78 * printScale;
    const maxBoxH = safeH * 0.76 * printScale;
    const imgAspect = img.width / Math.max(1, img.height);

    let dw = maxBoxW;
    let dh = dw / imgAspect;
    if (dh > maxBoxH) {
      dh = maxBoxH;
      dw = dh * imgAspect;
    }

    const centerX = size * 0.5;
    const defaultCenterY = size * (side === 'front' ? 0.48 : 0.45);
    const centerY = defaultCenterY + printOffsetY * size * 0.48;

    ctx.save();
    // Clip cleanly inside the safe flat torso zone so artwork never bleeds onto seams or collar
    ctx.beginPath();
    ctx.rect(safeLeft, safeTop, safeW, safeH);
    ctx.clip();

    // Soft-hand screen-print ink opacity (slightly lower in vintage wash mode)
    ctx.globalAlpha = override.washedEffect ? 0.87 : 0.95;
    ctx.drawImage(img, centerX - dw / 2, centerY - dh / 2, dw, dh);
    ctx.restore();
  } else {
    // 2B. Original PDF Artwork Extraction (respecting Scale, Vertical Offset, Base Color & Wash!)
    const pw = extract.pageCanvas.width;
    const ph = extract.pageCanvas.height;

    const rx = side === 'front' ? 0.116 : 0.616;
    const rw = 0.268;
    const ry = side === 'front' ? 0.22 : 0.2;
    const rh = side === 'front' ? 0.59 : 0.61;

    const sx = Math.round(pw * rx);
    const sy = Math.round(ph * ry);
    const sw = Math.round(pw * rw);
    const sh = Math.round(ph * rh);

    // Draw PDF crop onto temporary canvas so we can feather edges cleanly into chosen baseRgb
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = size;
    cropCanvas.height = size;
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })!;
    cropCtx.clearRect(0, 0, size, size);

    const baseDw = safeW * 0.98 * printScale;
    const baseDh = safeH * 0.98 * printScale;
    const cx = size * 0.5;
    const cy = size * (side === 'front' ? 0.535 : 0.515) + printOffsetY * size * 0.45;

    cropCtx.drawImage(
      extract.pageCanvas,
      sx,
      sy,
      sw,
      sh,
      cx - baseDw / 2,
      cy - baseDh / 2,
      baseDw,
      baseDh,
    );

    // Key out original PDF shirt background pixels smoothly when user changed base color OR
    // feather border pixels so there is zero rectangular edge anywhere on the torso!
    const cropImg = cropCtx.getImageData(0, 0, size, size);
    const cd = cropImg.data;
    const [origR, origG, origB] = extract.sampledRgb;
    const customColorSelected = override.baseHex !== null;

    const featherPx = Math.round(size * 0.048);
    const x0 = Math.max(safeLeft, Math.round(cx - baseDw / 2));
    const x1 = Math.min(safeRight, Math.round(cx + baseDw / 2));
    const y0 = Math.max(safeTop, Math.round(cy - baseDh / 2));
    const y1 = Math.min(safeBottom, Math.round(cy + baseDh / 2));

    for (let y = 0; y < size; y++) {
      let vy = 1;
      if (y < y0 || y > y1) vy = 0;
      else if (y < y0 + featherPx) vy = (y - y0) / featherPx;
      else if (y > y1 - featherPx) vy = (y1 - y) / featherPx;

      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (cd[i + 3] === 0) continue;

        let vx = 1;
        if (x < x0 || x > x1) vx = 0;
        else if (x < x0 + featherPx) vx = (x - x0) / featherPx;
        else if (x > x1 - featherPx) vx = (x1 - x) / featherPx;

        const edge = Math.min(vx, vy);
        const smoothEdge = edge * edge * (3 - 2 * edge);

        // Compute distance from the original PDF shirt fabric color
        const dist =
          Math.abs(cd[i] - origR) +
          Math.abs(cd[i + 1] - origG) +
          Math.abs(cd[i + 2] - origB);

        if (customColorSelected || override.washedEffect) {
          // Make bare PDF shirt background transparent so user's chosen base fabric color & wash show cleanly!
          const inkThresh = garment.printFinish === 'stealth-tonal' ? 12 : 28;
          const inkAlpha = Math.min(1, Math.max(0, (dist - inkThresh) / 36));
          cd[i + 3] = Math.round(cd[i + 3] * smoothEdge * inkAlpha);
        } else {
          cd[i + 3] = Math.round(cd[i + 3] * smoothEdge);
        }
      }
    }
    cropCtx.putImageData(cropImg, 0, 0);

    ctx.save();
    ctx.globalAlpha = override.washedEffect ? 0.9 : 0.98;
    ctx.drawImage(cropCanvas, 0, 0);
    ctx.restore();
  }

  // 3. Apply cotton knit weave multiply/overlay & vintage wash ON TOP of the artwork
  applyScreenPrintFabricIntegration(ctx, size, override.washedEffect);

  // 4. Build calibrated PBR Roughness Map (cotton = 0.90 matte; screenprint ink = 0.64..0.78 or glossy wax 0.38)
  const finalImg = ctx.getImageData(0, 0, size, size).data;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(512, 512);
  const rd = rImg.data;

  const cottonRough = override.washedEffect ? 236 : 228; // ~0.90-0.93 matte cotton
  // Screen-printed custom PNG gets realistic matte-satin plastisol roughness (~0.64),
  // never shiny plastic or glowing sticker!
  const targetInkRough = customPng
    ? override.washedEffect
      ? 0.78
      : 0.64
    : Math.max(0.36, garment.inkRoughness);
  const inkRoughByte = Math.round(targetInkRough * 255);

  for (let y = 0; y < 512; y++) {
    const sy = y * 2;
    for (let x = 0; x < 512; x++) {
      const sx = x * 2;
      const fi = (sy * size + sx) * 4;
      const diff =
        Math.abs(finalImg[fi] - baseSnapshot[fi]) +
        Math.abs(finalImg[fi + 1] - baseSnapshot[fi + 1]) +
        Math.abs(finalImg[fi + 2] - baseSnapshot[fi + 2]);

      const inkMask = Math.min(1, Math.max(0, (diff - 22) / 45));
      const rVal = Math.round(
        cottonRough + (inkRoughByte - cottonRough) * inkMask,
      );
      const ri = (y * 512 + x) * 4;
      rd[ri] = rVal;
      rd[ri + 1] = rVal;
      rd[ri + 2] = rVal;
      rd[ri + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = maxAnisotropy;
  albedo.wrapS = THREE.ClampToEdgeWrapping;
  albedo.wrapT = THREE.ClampToEdgeWrapping;
  albedo.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = Math.min(4, maxAnisotropy);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.needsUpdate = true;

  return { albedo, roughnessMap };
}

/**
 * Bakes complete 3D PBR textures & synchronized 2D thumbnails for a garment,
 * combining the original PDF reference with any user overrides saved in IndexedDB.
 */
export async function loadGarment3DAssets(
  garment: GarmentProduct,
  maxAnisotropy = 8,
  override?: GarmentArtworkOverride,
): Promise<BakedGarmentAssets> {
  const defaultWashed = garment.baseColor === 'brown';
  const effectiveOverride =
    override ?? createDefaultOverride(garment.id, defaultWashed);

  const extract = await getRawPdfPage(garment);
  const baseRgb: [number, number, number] = effectiveOverride.baseHex
    ? hexToRgb(effectiveOverride.baseHex)
    : extract.sampledRgb;
  const sampledHex = effectiveOverride.baseHex ?? extract.sampledHex;

  const [front, back] = await Promise.all([
    bakeTorsoTextures(
      extract,
      'front',
      garment,
      baseRgb,
      effectiveOverride,
      maxAnisotropy,
    ),
    bakeTorsoTextures(
      extract,
      'back',
      garment,
      baseRgb,
      effectiveOverride,
      maxAnisotropy,
    ),
  ]);

  const fabricSolidTexture = bakeSolidFabricTexture(
    baseRgb,
    effectiveOverride.washedEffect,
    maxAnisotropy,
  );

  const customized = hasCustomizations(effectiveOverride, defaultWashed);
  const colorOrWashChanged =
    effectiveOverride.baseHex !== null ||
    effectiveOverride.washedEffect !== defaultWashed;

  const [frontThumbUrl, backThumbUrl] = customized
    ? await Promise.all([
        renderCustomFlatLayThumb(
          'front',
          baseRgb,
          effectiveOverride.washedEffect,
          effectiveOverride.frontPngDataUrl,
          effectiveOverride.frontScale,
          effectiveOverride.frontOffsetY,
          extract.pdfFrontThumbUrl,
          colorOrWashChanged,
        ),
        renderCustomFlatLayThumb(
          'back',
          baseRgb,
          effectiveOverride.washedEffect,
          effectiveOverride.backPngDataUrl,
          effectiveOverride.backScale,
          effectiveOverride.backOffsetY,
          extract.pdfBackThumbUrl,
          colorOrWashChanged,
        ),
      ])
    : [extract.pdfFrontThumbUrl, extract.pdfBackThumbUrl];

  return {
    pageNumber: garment.pageNumber,
    frontTexture: front.albedo,
    backTexture: back.albedo,
    frontRoughnessMap: front.roughnessMap,
    backRoughnessMap: back.roughnessMap,
    fabricSolidTexture,
    sampledHex,
    washedEffect: effectiveOverride.washedEffect,
    frontThumbUrl,
    backThumbUrl,
  };
}

/**
 * Generates thumbnails for the 17-piece Collection Drawer & 3D Showroom Ring,
 * respecting any saved IndexedDB custom PNG artwork or fabric color overrides.
 */
export async function loadGarmentThumbnails(
  garment: GarmentProduct,
  override?: GarmentArtworkOverride,
): Promise<GarmentThumbPair> {
  const defaultWashed = garment.baseColor === 'brown';
  const customized = hasCustomizations(override, defaultWashed);

  if (customized && override) {
    const baseRgb = override.baseHex
      ? hexToRgb(override.baseHex)
      : hexToRgb(garment.baseHex);

    let fallbackFront = thumbCache.get(garment.pageNumber)?.frontThumbUrl ?? '';
    let fallbackBack = thumbCache.get(garment.pageNumber)?.backThumbUrl ?? '';
    if (!override.frontPngDataUrl || !override.backPngDataUrl) {
      const pdfPair = await loadPdfOnlyThumbnails(garment);
      fallbackFront = pdfPair.frontThumbUrl;
      fallbackBack = pdfPair.backThumbUrl;
    }

    const colorOrWashChanged =
      override.baseHex !== null || override.washedEffect !== defaultWashed;

    const [frontThumbUrl, backThumbUrl] = await Promise.all([
      renderCustomFlatLayThumb(
        'front',
        baseRgb,
        override.washedEffect,
        override.frontPngDataUrl,
        override.frontScale,
        override.frontOffsetY,
        fallbackFront,
        colorOrWashChanged,
      ),
      renderCustomFlatLayThumb(
        'back',
        baseRgb,
        override.washedEffect,
        override.backPngDataUrl,
        override.backScale,
        override.backOffsetY,
        fallbackBack,
        colorOrWashChanged,
      ),
    ]);
    return { frontThumbUrl, backThumbUrl };
  }

  return loadPdfOnlyThumbnails(garment);
}

async function loadPdfOnlyThumbnails(
  garment: GarmentProduct,
): Promise<GarmentThumbPair> {
  const cached = thumbCache.get(garment.pageNumber);
  if (cached) return cached;

  const existing = inFlightThumb.get(garment.pageNumber);
  if (existing) return existing;

  const task = (async () => {
    const pageCanvas = await renderPdfPageToCanvas(garment.pageNumber, 1100);
    const frontThumbUrl = extractFlatLayThumb(
      pageCanvas,
      'front',
      garment.baseColor,
      440,
    );
    const backThumbUrl = extractFlatLayThumb(
      pageCanvas,
      'back',
      garment.baseColor,
      440,
    );
    const pair = { frontThumbUrl, backThumbUrl };
    thumbCache.set(garment.pageNumber, pair);
    inFlightThumb.delete(garment.pageNumber);
    return pair;
  })();

  inFlightThumb.set(garment.pageNumber, task);
  return task;
}

export function disposeBakedGarmentAssets(assets: BakedGarmentAssets | null): void {
  if (!assets) return;
  assets.frontTexture.dispose();
  assets.backTexture.dispose();
  assets.frontRoughnessMap.dispose();
  assets.backRoughnessMap.dispose();
  assets.fabricSolidTexture?.dispose();
}
