import * as THREE from 'three';
import { GarmentProduct } from '../data/catalog';
import { BakedGarmentAssets } from '../utils/pdfArtworkPipeline';
import { ProceduralTextureSuite } from './fabricTextures';

export interface SculptedTeeRig {
  root: THREE.Group;
  garmentGroup: THREE.Group;
  suspensionGroup: THREE.Group;
  applyGarmentAssets: (garment: GarmentProduct, assets: BakedGarmentAssets) => void;
  setBasePreviewColor: (hex: string) => void;
  setSuspensionVisible: (visible: boolean) => void;
  updateIdleMotion: (elapsed: number, macroMode: boolean) => void;
  dispose: () => void;
}

/**
 * Evaluates the 3D neckline curve so the front torso, back torso, ribbed collar,
 * and interior yoke align seamlessly with zero gaps.
 */
function sampleNeckPoint(theta: number): THREE.Vector3 {
  // theta = 0 is front center (+Z), PI/2 is right shoulder (+X), PI is back center (-Z)
  const rx = 0.215;
  const rz = 0.145;
  const x = Math.sin(theta) * rx;
  const z = Math.cos(theta) * rz;
  // Front dips lower (0.565), sides sit at collar-shoulder junction (0.73), back curves gently (0.685)
  const frontFactor = Math.max(0, Math.cos(theta));
  const backFactor = Math.max(0, -Math.cos(theta));
  const y = 0.732 - frontFactor * frontFactor * 0.155 - backFactor * backFactor * 0.048;
  return new THREE.Vector3(x, y, z);
}

/**
 * Computes the sculptural contoured torso surface for either front (+1) or back (-1).
 * Uses planar-weighted UVs derived directly from physical (x, y) coordinates so
 * original PDF chest and back artwork renders with zero distortion.
 */
function buildTorsoPanelGeometry(sideSign: 1 | -1): THREE.BufferGeometry {
  const segX = 60;
  const segY = 64;
  const vertCount = (segX + 1) * (segY + 1);

  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  const neckHalfRatio = 0.345; // |s| inside collar opening
  const yBottom = -0.74;

  let ptr = 0;
  let uvPtr = 0;

  for (let iy = 0; iy <= segY; iy++) {
    const v = iy / segY; // 0 = bottom hem, 1 = shoulder/neck top
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX; // 0..1 left-to-right in world X
      const s = u * 2 - 1; // -1..+1
      const ax = Math.abs(s);

      // Oversized boxy streetwear silhouette width profile
      const waistTaper = 1 - 0.03 * Math.sin(v * Math.PI);
      const shoulderFlare = 0.045 * Math.pow(Math.max(0, v - 0.35) / 0.65, 1.7);
      const halfW = (0.585 + shoulderFlare) * waistTaper;
      const x = s * halfW;

      // Top profile: dipped crewneck in center, sloping drop-shoulder outward
      let yTop: number;
      if (ax < neckHalfRatio) {
        const t = ax / neckHalfRatio; // 0 at center, 1 at collar edge
        const dip = sideSign > 0 ? 0.155 : 0.048;
        yTop = 0.732 - dip * Math.cos(t * Math.PI * 0.5) * Math.cos(t * Math.PI * 0.5);
      } else {
        const t = (ax - neckHalfRatio) / (1 - neckHalfRatio);
        // Gentle anatomical shoulder slope from collar seam down to drop-shoulder edge
        yTop = 0.732 - 0.155 * Math.pow(t, 1.18);
      }

      // Subtle hem gravity curve at bottom
      const hemDrop = (1 - v) * (1 - v) * (-0.015 * Math.cos(s * Math.PI * 0.5));
      const y = THREE.MathUtils.lerp(yBottom, yTop, v) + hemDrop;

      // 3D depth volume: meets seamlessly at z=0 along side seams (|s|=1) & shoulder seams
      const sideArch = Math.pow(Math.max(0, 1 - s * s), 0.54);

      // Shoulder seam closes smoothly to z=0 for |s| >= neckHalfRatio as v -> 1,
      // while neck opening stays rounded open at z = ±0.145 * sqrt(1 - (s/neckHalfRatio)^2)
      const collarBlend = THREE.MathUtils.smoothstep(ax, neckHalfRatio - 0.05, neckHalfRatio + 0.09);
      const shoulderPinch = Math.pow(
        Math.max(0, 1 - Math.pow(Math.max(0, (v - 0.64) / 0.36), 2.1)),
        0.52,
      );
      const topEnvelope = THREE.MathUtils.lerp(1.0, shoulderPinch, collarBlend);

      // Anatomical chest fullness (front) / upper back contour (back)
      const chestBulge =
        sideSign > 0
          ? 0.2 + 0.05 * Math.exp(-Math.pow((v - 0.64) / 0.24, 2))
          : 0.185 + 0.032 * Math.exp(-Math.pow((v - 0.7) / 0.25, 2));

      // Blend collar edge Z neatly to match sampleNeckPoint radius (0.145)
      let depth = chestBulge * sideArch * topEnvelope;
      if (ax < neckHalfRatio && v > 0.76) {
        const neckT = THREE.MathUtils.smoothstep(v, 0.76, 1.0);
        const neckZ = 0.145 * Math.sqrt(Math.max(0, 1 - (ax / neckHalfRatio) ** 2));
        depth = THREE.MathUtils.lerp(depth, neckZ, neckT);
      }

      // Subtle natural gravity folds strongest near bottom hem, minimal across print area
      const foldWeight = Math.pow(1 - v, 1.75) * sideArch;
      const drapeFold =
        (Math.sin(s * Math.PI * 3.5 + (sideSign > 0 ? 0.3 : 1.7)) * 0.014 +
          Math.cos(s * Math.PI * 6.0) * 0.005) *
        foldWeight;

      const z = sideSign * (depth + drapeFold);

      positions[ptr++] = x;
      positions[ptr++] = y;
      positions[ptr++] = z;

      // Planar-calibrated UVs matching our baked PDF torso canvas (1:1 aspect ratio, zero distortion)
      // Back panel flips U so back text reads left-to-right when viewed from behind (-Z)
      const uvU =
        sideSign > 0
          ? THREE.MathUtils.clamp(x / 1.24 + 0.5, 0.002, 0.998)
          : THREE.MathUtils.clamp(-x / 1.24 + 0.5, 0.002, 0.998);
      const uvV = THREE.MathUtils.clamp((y - yBottom) / (0.74 - yBottom), 0.002, 0.998);

      uvs[uvPtr++] = uvU;
      uvs[uvPtr++] = uvV;
    }
  }

  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * (segX + 1) + ix;
      const b = a + 1;
      const c = a + (segX + 1);
      const d = c + 1;

      if (sideSign > 0) {
        indices.push(a, b, d);
        indices.push(a, d, c);
      } else {
        indices.push(a, d, b);
        indices.push(a, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted boxy drop-shoulder oversized sleeve with natural downward drape and
 * folded double-wall inner cuff return so the sleeve opening has authentic thickness.
 */
function buildSleeveGeometry(side: -1 | 1): THREE.BufferGeometry {
  const lenSegs = 28;
  const radSegs = 36;

  // Spine curve from inside upper shoulder seam out and downward to elbow-grazing boxy cuff
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.48, 0.44, -0.01),
    new THREE.Vector3(side * 0.67, 0.39, 0.0),
    new THREE.Vector3(side * 0.89, 0.25, 0.015),
    new THREE.Vector3(side * 1.07, 0.07, 0.025),
  ]);

  // Extra 3 rings at cuff fold inward into the sleeve interior for physical garment thickness
  const totalRings = lenSegs + 4;
  const vertCount = totalRings * (radSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const upRef = new THREE.Vector3(0, 1, 0);
  const normalVec = new THREE.Vector3();
  const binormalVec = new THREE.Vector3();
  const center = new THREE.Vector3();

  let ptr = 0;
  let uvPtr = 0;

  for (let i = 0; i < totalRings; i++) {
    let t: number;
    let radiusScale = 1.0;

    if (i <= lenSegs) {
      t = i / lenSegs;
    } else if (i === lenSegs + 1) {
      // Rounded cuff hem lip
      t = 1.005;
      radiusScale = 0.96;
    } else if (i === lenSegs + 2) {
      // Folded inside sleeve cuff
      t = 0.94;
      radiusScale = 0.89;
    } else {
      // Deep interior cuff shadow taper
      t = 0.72;
      radiusScale = 0.74;
    }

    const clampedT = Math.min(1, t);
    spine.getPoint(clampedT, center);
    spine.getTangent(clampedT, tangent).normalize();

    // Extrapolate slightly past 1.0 for rounded hem lip
    if (t > 1) {
      center.addScaledVector(tangent, (t - 1) * 0.45);
    }

    binormalVec.crossVectors(tangent, upRef).normalize();
    normalVec.crossVectors(binormalVec, tangent).normalize();

    // Boxy drop-shoulder arm cross-section (taller vertically near armhole, roomy boxy cuff)
    const rVert = THREE.MathUtils.lerp(0.245, 0.188, clampedT) * radiusScale;
    const rDepth = THREE.MathUtils.lerp(0.178, 0.158, clampedT) * radiusScale;

    for (let j = 0; j <= radSegs; j++) {
      const a = (j / radSegs) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      // Gentle underarm drape fold
      const fold =
        i <= lenSegs
          ? Math.sin(a * 3 + clampedT * 4) * 0.007 * Math.sin(clampedT * Math.PI)
          : 0;

      // Slight downward gravity sag on the bottom underside of the sleeve
      const underSag = sinA < 0 ? Math.abs(sinA) * 0.022 * clampedT : 0;

      const px =
        center.x +
        binormalVec.x * (cosA * (rDepth + fold)) +
        normalVec.x * (sinA * (rVert + fold)) ;
      const py =
        center.y +
        binormalVec.y * (cosA * (rDepth + fold)) +
        normalVec.y * (sinA * (rVert + fold)) -
        underSag;
      const pz =
        center.z +
        binormalVec.z * (cosA * (rDepth + fold)) +
        normalVec.z * (sinA * (rVert + fold));

      positions[ptr++] = px;
      positions[ptr++] = py;
      positions[ptr++] = pz;

      uvs[uvPtr++] = j / radSegs;
      uvs[uvPtr++] = clampedT;
    }
  }

  for (let i = 0; i < totalRings - 1; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = i * (radSegs + 1) + j;
      const b = a + 1;
      const c = a + (radSegs + 1);
      const d = c + 1;

      if (side > 0) {
        indices.push(a, c, d);
        indices.push(a, d, b);
      } else {
        indices.push(a, d, c);
        indices.push(a, b, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Heavyweight 1.2-inch ribbed crewneck collar swept seamlessly around the exact 3D neck curve.
 */
function buildRibbedCollarGeometry(): THREE.BufferGeometry {
  const pathSegs = 64;
  const profileSegs = 16;
  const vertCount = (pathSegs + 1) * (profileSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  const tubeRadiusRadial = 0.022;
  const tubeRadiusVertical = 0.036;

  let ptr = 0;
  let uvPtr = 0;

  for (let i = 0; i <= pathSegs; i++) {
    const u = i / pathSegs;
    const theta = u * Math.PI * 2;
    const center = sampleNeckPoint(theta);

    // Outward horizontal radial normal from neck center
    const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    for (let j = 0; j <= profileSegs; j++) {
      const v = j / profileSegs;
      const phi = v * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      const px = center.x + radial.x * (cosP * tubeRadiusRadial);
      const py = center.y + 0.012 + sinP * tubeRadiusVertical;
      const pz = center.z + radial.z * (cosP * tubeRadiusRadial);

      positions[ptr++] = px;
      positions[ptr++] = py;
      positions[ptr++] = pz;

      uvs[uvPtr++] = u;
      uvs[uvPtr++] = v;
    }
  }

  for (let i = 0; i < pathSegs; i++) {
    for (let j = 0; j < profileSegs; j++) {
      const a = i * (profileSegs + 1) + j;
      const b = a + 1;
      const c = a + (profileSegs + 1);
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Stitched double-needle bottom waist hem welt loop following the torso hem contour.
 */
function buildBottomHemTrimGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const s = Math.cos(angle);
    const sideSign = Math.sin(angle) >= 0 ? 1 : -1;
    const x = s * 0.585;
    const sideArch = Math.pow(Math.max(0, 1 - s * s), 0.54);
    const baseDepth = sideSign > 0 ? 0.2 : 0.185;
    const drapeFold =
      (Math.sin(s * Math.PI * 3.5 + (sideSign > 0 ? 0.3 : 1.7)) * 0.014 +
        Math.cos(s * Math.PI * 6.0) * 0.005) *
      sideArch;
    const z = sideSign * (baseDepth * sideArch + drapeFold);
    const y = -0.74 - 0.015 * Math.cos(s * Math.PI * 0.5);
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return new THREE.TubeGeometry(curve, 84, 0.012, 8, true);
}

/**
 * Builds the interior back-neck cavity lining so peering down into the crewneck
 * shows realistic dark inner fabric + woven PENANCE PIERCE satin neck tag.
 */
function buildInteriorNeckShell(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.215, 0.36, 0.34, 32, 1, true, Math.PI * 0.58, Math.PI * 0.84);
  geo.translate(0, 0.53, -0.015);
  return geo;
}

/**
 * Architectural brushed-chrome gallery suspension hardware (minimal curved collar rail,
 * machined clamp cylinders, crimson indicator ring, and tension cable).
 */
function buildSuspensionHardware(): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4d4d8,
    metalness: 0.96,
    roughness: 0.16,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
  });
  const darkChromeMat = new THREE.MeshStandardMaterial({
    color: 0x26262c,
    metalness: 0.9,
    roughness: 0.28,
  });
  const crimsonAccentMat = new THREE.MeshStandardMaterial({
    color: 0xc81e2b,
    emissive: 0xc81e2b,
    emissiveIntensity: 0.45,
    metalness: 0.3,
    roughness: 0.35,
  });
  disposables.push(chromeMat, darkChromeMat, crimsonAccentMat);

  // Curved brushed-chrome shoulder yoke bar hovering cleanly along collar line
  const barCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.49, 0.65, 0),
    new THREE.Vector3(-0.22, 0.77, 0),
    new THREE.Vector3(0, 0.82, 0),
    new THREE.Vector3(0.22, 0.77, 0),
    new THREE.Vector3(0.49, 0.65, 0),
  ]);
  const barGeo = new THREE.TubeGeometry(barCurve, 40, 0.012, 12, false);
  const barMesh = new THREE.Mesh(barGeo, chromeMat);
  barMesh.castShadow = true;
  group.add(barMesh);
  disposables.push(barGeo);

  // Machined collar-end caps
  const capGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.036, 16);
  const leftCap = new THREE.Mesh(capGeo, darkChromeMat);
  leftCap.position.set(-0.49, 0.65, 0);
  leftCap.rotation.z = Math.PI * 0.38;
  const rightCap = new THREE.Mesh(capGeo, darkChromeMat);
  rightCap.position.set(0.49, 0.65, 0);
  rightCap.rotation.z = -Math.PI * 0.38;
  group.add(leftCap, rightCap);
  disposables.push(capGeo);

  // Central machined suspension hub
  const hubGeo = new THREE.CylinderGeometry(0.026, 0.03, 0.085, 20);
  const hub = new THREE.Mesh(hubGeo, darkChromeMat);
  hub.position.set(0, 0.855, 0);
  group.add(hub);
  disposables.push(hubGeo);

  // Recessed blood-red precision ring on the hub
  const ringGeo = new THREE.TorusGeometry(0.0285, 0.0045, 10, 28);
  const ring = new THREE.Mesh(ringGeo, crimsonAccentMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.855, 0);
  group.add(ring);
  disposables.push(ringGeo);

  // Slim tension cable ascending into gallery darkness
  const cableGeo = new THREE.CylinderGeometry(0.004, 0.004, 5.2, 8);
  const cable = new THREE.Mesh(cableGeo, chromeMat);
  cable.position.set(0, 3.48, 0);
  group.add(cable);
  disposables.push(cableGeo);

  return { group, disposables };
}

/**
 * Assembles the complete composite 9-part sculpted heavyweight 3D streetwear T-shirt rig.
 */
export function createSculptedTeeRig(
  textures: ProceduralTextureSuite,
): SculptedTeeRig {
  const root = new THREE.Group();
  const garmentGroup = new THREE.Group();
  root.add(garmentGroup);

  // Materials: Front Torso, Back Torso, Solid Cotton (Sleeves/Hem), Ribbed Collar, Interior Lining, Woven Tag
  // Screen-print realistic calibration: zero emissive glow, crisp cotton bumpMap visible ON TOP of ink,
  // and full studio lighting shadow reception across both cotton and printed graphic zones.
  const frontMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    roughness: 1.0,
    metalness: 0.0,
    bumpMap: textures.cottonBumpMap,
    bumpScale: 0.0072,
    sheen: 0.36,
    sheenRoughness: 0.84,
    sheenColor: new THREE.Color(0x2a2a30),
    clearcoat: 0.0,
    clearcoatRoughness: 0.45,
    side: THREE.FrontSide,
  });

  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    roughness: 1.0,
    metalness: 0.0,
    bumpMap: textures.cottonBumpMap,
    bumpScale: 0.0072,
    sheen: 0.36,
    sheenRoughness: 0.84,
    sheenColor: new THREE.Color(0x2a2a30),
    clearcoat: 0.0,
    clearcoatRoughness: 0.45,
    side: THREE.FrontSide,
  });

  const fabricSolidMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.91,
    metalness: 0.0,
    bumpMap: textures.cottonBumpMap,
    bumpScale: 0.0068,
    sheen: 0.36,
    sheenRoughness: 0.84,
    sheenColor: new THREE.Color(0x2a2a30),
    side: THREE.DoubleSide,
  });

  const collarMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0,
    bumpMap: textures.collarRibBumpMap,
    bumpScale: 0.011,
    sheen: 0.3,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0x323238),
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.BackSide,
  });

  const neckTagMat = new THREE.MeshStandardMaterial({
    map: textures.neckLabelMap,
    roughness: 0.55,
    metalness: 0.05,
  });

  // 1 & 2. Contoured Front and Back Torso Panels
  const frontGeo = buildTorsoPanelGeometry(1);
  const backGeo = buildTorsoPanelGeometry(-1);
  const frontMesh = new THREE.Mesh(frontGeo, frontMat);
  const backMesh = new THREE.Mesh(backGeo, backMat);
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;

  // Inner dark back-faces of torso so viewing upward from under hem never looks hollow
  const frontInnerMesh = new THREE.Mesh(frontGeo, interiorMat);
  const backInnerMesh = new THREE.Mesh(backGeo, interiorMat);

  // 3 & 4. Drop-Shoulder Oversized Sleeves
  const leftSleeveGeo = buildSleeveGeometry(-1);
  const rightSleeveGeo = buildSleeveGeometry(1);
  const leftSleeve = new THREE.Mesh(leftSleeveGeo, fabricSolidMat);
  const rightSleeve = new THREE.Mesh(rightSleeveGeo, fabricSolidMat);
  leftSleeve.castShadow = true;
  leftSleeve.receiveShadow = true;
  rightSleeve.castShadow = true;
  rightSleeve.receiveShadow = true;

  // 5. Heavyweight Ribbed Crewneck Collar
  const collarGeo = buildRibbedCollarGeometry();
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;

  // 6. Double-Needle Stitched Bottom Hem Trim
  const hemGeo = buildBottomHemTrimGeometry();
  const hemMesh = new THREE.Mesh(hemGeo, fabricSolidMat);
  hemMesh.castShadow = true;

  // 7. Interior Neck Back-Yoke & Woven Satin Label
  const innerNeckGeo = buildInteriorNeckShell();
  const innerNeckMesh = new THREE.Mesh(innerNeckGeo, interiorMat);

  const neckTagGeo = new THREE.PlaneGeometry(0.155, 0.078, 8, 2);
  // Gently curve the woven satin neck tag along the inner back yoke
  const tagPos = neckTagGeo.attributes.position;
  for (let i = 0; i < tagPos.count; i++) {
    const tx = tagPos.getX(i);
    tagPos.setZ(i, -(tx * tx) * 1.4);
  }
  neckTagGeo.computeVertexNormals();
  const neckTagMesh = new THREE.Mesh(neckTagGeo, neckTagMat);
  neckTagMesh.position.set(0, 0.612, -0.118);

  // 8. Architectural Brushed-Chrome Suspension Hardware
  const { group: suspensionGroup, disposables: hardwareDisposables } =
    buildSuspensionHardware();

  garmentGroup.add(
    frontMesh,
    backMesh,
    frontInnerMesh,
    backInnerMesh,
    leftSleeve,
    rightSleeve,
    collarMesh,
    hemMesh,
    innerNeckMesh,
    neckTagMesh,
    suspensionGroup,
  );

  // Elevate garment cleanly above the inspection plinth (bottom hem hovers ~0.34 above plinth top)
  garmentGroup.position.y = 1.12;

  const setBasePreviewColor = (hex: string) => {
    const baseColor = new THREE.Color(hex);
    if (!fabricSolidMat.map) {
      fabricSolidMat.color.copy(baseColor);
    }
    if (!collarMat.map) {
      collarMat.color.copy(baseColor);
    }
    const isLight = baseColor.r > 0.6;
    const sheenCol = isLight ? new THREE.Color(0xf8f8f6) : new THREE.Color(0x2c2c34);
    fabricSolidMat.sheenColor.copy(sheenCol);
    collarMat.sheenColor.copy(sheenCol);
    frontMat.sheenColor.copy(sheenCol);
    backMat.sheenColor.copy(sheenCol);
    interiorMat.color.copy(baseColor).multiplyScalar(isLight ? 0.72 : 0.45);
  };

  const applyGarmentAssets = (
    garment: GarmentProduct,
    assets: BakedGarmentAssets,
  ) => {
    // Apply unified cotton/washed fabric texture to sleeves, hem & collar so all parts match seamlessly
    if (assets.fabricSolidTexture) {
      fabricSolidMat.map = assets.fabricSolidTexture;
      fabricSolidMat.color.setHex(0xffffff);
      fabricSolidMat.roughness = assets.washedEffect ? 0.94 : 0.9;
      fabricSolidMat.needsUpdate = true;

      collarMat.map = assets.fabricSolidTexture;
      collarMat.color.setHex(0xffffff);
      collarMat.roughness = assets.washedEffect ? 0.9 : 0.85;
      collarMat.needsUpdate = true;
    } else {
      fabricSolidMat.map = null;
      collarMat.map = null;
      fabricSolidMat.color.set(assets.sampledHex);
      collarMat.color.set(assets.sampledHex);
      fabricSolidMat.needsUpdate = true;
      collarMat.needsUpdate = true;
    }

    setBasePreviewColor(assets.sampledHex);

    // Front & back screen-print PBR materials: keep fabric shadows & cotton weave crisp on top of print
    const isWashed = assets.washedEffect;
    frontMat.map = assets.frontTexture;
    frontMat.roughnessMap = assets.frontRoughnessMap;
    frontMat.roughness = 1.0; // Driven per-pixel by roughnessMap
    frontMat.metalness = isWashed ? 0.0 : garment.inkMetalness * 0.14;
    frontMat.clearcoat = isWashed ? 0.0 : garment.inkClearcoat * 0.14;
    frontMat.clearcoatRoughness = Math.max(0.28, garment.inkRoughness);
    frontMat.bumpScale = isWashed ? 0.0085 : 0.0072;
    frontMat.needsUpdate = true;

    backMat.map = assets.backTexture;
    backMat.roughnessMap = assets.backRoughnessMap;
    backMat.roughness = 1.0;
    backMat.metalness =
      !isWashed && garment.hasBackGraphic ? garment.inkMetalness * 0.12 : 0;
    backMat.clearcoat =
      !isWashed && garment.hasBackGraphic ? garment.inkClearcoat * 0.12 : 0;
    backMat.clearcoatRoughness = Math.max(0.28, garment.inkRoughness);
    backMat.bumpScale = isWashed ? 0.0085 : 0.0072;
    backMat.needsUpdate = true;
  };

  const setSuspensionVisible = (visible: boolean) => {
    suspensionGroup.visible = visible;
  };

  const updateIdleMotion = (elapsed: number, macroMode: boolean) => {
    // Pause gentle levitation during macro zoom so fabric grain stays rock-steady
    const amp = macroMode ? 0.002 : 0.018;
    garmentGroup.position.y = 1.12 + Math.sin(elapsed * 1.15) * amp;
    garmentGroup.rotation.z = Math.sin(elapsed * 0.75) * (macroMode ? 0.0 : 0.008);
  };

  const dispose = () => {
    frontGeo.dispose();
    backGeo.dispose();
    leftSleeveGeo.dispose();
    rightSleeveGeo.dispose();
    collarGeo.dispose();
    hemGeo.dispose();
    innerNeckGeo.dispose();
    neckTagGeo.dispose();

    frontMat.dispose();
    backMat.dispose();
    fabricSolidMat.dispose();
    collarMat.dispose();
    interiorMat.dispose();
    neckTagMat.dispose();

    hardwareDisposables.forEach((d) => d.dispose());
  };

  return {
    root,
    garmentGroup,
    suspensionGroup,
    applyGarmentAssets,
    setBasePreviewColor,
    setSuspensionVisible,
    updateIdleMotion,
    dispose,
  };
}
