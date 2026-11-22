import * as THREE from 'three';

export interface ProceduralTextureSuite {
  cottonBumpMap: THREE.CanvasTexture;
  collarRibBumpMap: THREE.CanvasTexture;
  neckLabelMap: THREE.CanvasTexture;
  basaltRoughnessMap: THREE.CanvasTexture;
  stageRingGraphicMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates a tileable 280GSM heavyweight cotton jersey knit bump/micro-weave texture.
 * Visible up close during macro zoom inspection.
 */
function createCottonWeaveBump(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;

  // Deterministic jersey knit V-stitch micro pattern + organic cotton fiber slub
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Interlocking vertical knit wales & horizontal courses
      const wale = Math.sin((x / 4.0) * Math.PI * 2);
      const course = Math.sin(((y + (x % 4) * 0.5) / 5.5) * Math.PI * 2);
      const weave = wale * 0.55 + course * 0.45;
      const microNoise = (rand() - 0.5) * 26;
      const val = Math.max(0, Math.min(255, Math.round(128 + weave * 28 + microNoise)));
      const idx = (y * size + x) * 4;
      d[idx] = val;
      d[idx + 1] = val;
      d[idx + 2] = val;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 10);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates vertical 1x1 heavyweight crewneck rib texture for the collar band.
 */
function createCollarRibBump(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const img = ctx.createImageData(width, height);
  const d = img.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rib = Math.sin((x / 6.0) * Math.PI * 2);
      const course = Math.sin((y / 5.0) * Math.PI * 2) * 0.2;
      const val = Math.max(0, Math.min(255, Math.round(128 + (rib + course) * 58)));
      const idx = (y * width + x) * 4;
      d[idx] = val;
      d[idx + 1] = val;
      d[idx + 2] = val;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 1);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the woven obsidian satin interior neck label with crimson bar-tack stitches.
 */
function createWovenNeckLabel(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Matte woven black satin base
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle horizontal satin weave sheen lines
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Hairline silver interior border
  ctx.strokeStyle = 'rgba(212,212,216,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 476, 220);

  // Blood-red bar-tack corner stitches
  ctx.fillStyle = '#C81E2B';
  ctx.fillRect(28, 28, 34, 7);
  ctx.fillRect(450, 28, 34, 7);

  // Woven silver-white brand typography
  ctx.fillStyle = '#E4E4E7';
  ctx.textAlign = 'center';
  ctx.font = '600 42px Cinzel, Georgia, serif';
  ctx.fillText('PENANCE PIERCE', 256, 128);

  ctx.fillStyle = '#9A9AA4';
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  ctx.fillText('ART & GRAPHIC DEPT  ·  280 GSM', 256, 174);

  ctx.fillStyle = '#C81E2B';
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillText('ARCHIVE EDITION', 256, 208);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates dark monolithic basalt concrete/stone grain roughness map for the plinth & floor.
 */
function createBasaltRoughnessMap(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9E9E9E';
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 14;
    const shade = Math.round(110 + rand() * 95);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.09)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the architectural radial degree dial etched around the obsidian plinth perimeter.
 */
function createStageRingGraphic(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Outer fine chrome circle
  ctx.strokeStyle = 'rgba(212, 212, 216, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 465, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle
  ctx.strokeStyle = 'rgba(212, 212, 216, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 382, 0, Math.PI * 2);
  ctx.stroke();

  // 72 radial precision ticks
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const isCardinal = i % 18 === 0;
    const isMajor = i % 6 === 0;
    const r1 = isCardinal ? 430 : isMajor ? 444 : 454;
    const r2 = 465;

    ctx.strokeStyle = isCardinal
      ? 'rgba(200, 30, 43, 0.85)'
      : isMajor
        ? 'rgba(228, 228, 231, 0.45)'
        : 'rgba(228, 228, 231, 0.18)';
    ctx.lineWidth = isCardinal ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft radial contact shadow texture placed beneath the plinth and floating garment.
 */
function createContactShadowMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextureSuite(
  maxAnisotropy: number,
): ProceduralTextureSuite {
  const cottonBumpMap = createCottonWeaveBump(maxAnisotropy);
  const collarRibBumpMap = createCollarRibBump(maxAnisotropy);
  const neckLabelMap = createWovenNeckLabel(maxAnisotropy);
  const basaltRoughnessMap = createBasaltRoughnessMap(maxAnisotropy);
  const stageRingGraphicMap = createStageRingGraphic(maxAnisotropy);
  const contactShadowMap = createContactShadowMap();

  return {
    cottonBumpMap,
    collarRibBumpMap,
    neckLabelMap,
    basaltRoughnessMap,
    stageRingGraphicMap,
    contactShadowMap,
    dispose: () => {
      cottonBumpMap.dispose();
      collarRibBumpMap.dispose();
      neckLabelMap.dispose();
      basaltRoughnessMap.dispose();
      stageRingGraphicMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
