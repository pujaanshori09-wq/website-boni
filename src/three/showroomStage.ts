import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GarmentProduct } from '../data/catalog';
import { ProceduralTextureSuite } from './fabricTextures';

export type LightingPreset = 'obsidian' | 'studio' | 'crimson';

export interface RingSlotItem {
  garment: GarmentProduct;
  group: THREE.Group;
  frameMat: THREE.MeshStandardMaterial;
  plateMat: THREE.MeshStandardMaterial;
  beaconMat: THREE.MeshStandardMaterial;
  hitProxy: THREE.Mesh;
  angle: number;
  baseY: number;
}

export interface ShowroomStageRig {
  stageGroup: THREE.Group;
  ringGroup: THREE.Group;
  ringSlots: RingSlotItem[];
  raycastTargets: THREE.Object3D[];
  applyLightingPreset: (preset: LightingPreset) => void;
  updateLightingDamp: (dt: number) => void;
  setActiveRingGarment: (garmentId: string, hoveredId: string | null) => void;
  setRingTexture: (
    garmentId: string,
    dataUrl: string,
    forceReplace?: boolean,
  ) => void;
  updateRingVisibility: (mode: 'stage' | 'ring', elapsed: number, dt: number) => void;
  dispose: () => void;
}

interface LightTargetValues {
  keyIntensity: number;
  keyColor: THREE.Color;
  hemiIntensity: number;
  hemiSky: THREE.Color;
  crimsonRimIntensity: number;
  chromeRimIntensity: number;
  fillIntensity: number;
  plinthGlow: number;
  exposure: number;
}

const LIGHTING_PRESETS: Record<LightingPreset, LightTargetValues> = {
  obsidian: {
    keyIntensity: 2.35,
    keyColor: new THREE.Color(0xfff6ed),
    hemiIntensity: 0.72,
    hemiSky: new THREE.Color(0x9fb3c8),
    crimsonRimIntensity: 3.1,
    chromeRimIntensity: 2.2,
    fillIntensity: 1.05,
    plinthGlow: 1.35,
    exposure: 1.08,
  },
  studio: {
    keyIntensity: 2.85,
    keyColor: new THREE.Color(0xffffff),
    hemiIntensity: 1.15,
    hemiSky: new THREE.Color(0xdbe4f0),
    crimsonRimIntensity: 0.65,
    chromeRimIntensity: 2.6,
    fillIntensity: 1.75,
    plinthGlow: 0.55,
    exposure: 1.18,
  },
  crimson: {
    keyIntensity: 1.65,
    keyColor: new THREE.Color(0xffdede),
    hemiIntensity: 0.48,
    hemiSky: new THREE.Color(0x7c2d35),
    crimsonRimIntensity: 5.2,
    chromeRimIntensity: 1.6,
    fillIntensity: 0.75,
    plinthGlow: 2.4,
    exposure: 1.04,
  },
};

function createIndexBadgeTexture(indexLabel: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0B0B0E';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = 'rgba(212,212,216,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 120, 56);
  ctx.fillStyle = '#E4E4E7';
  ctx.font = '500 28px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(indexLabel, 64, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the obsidian basalt inspection plinth, monolithic dark floor, 17-piece
 * interactive 3D Showroom Ring, and studio PBR + crimson/chrome lighting rig.
 */
export function createShowroomStage(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  catalog: GarmentProduct[],
  textures: ProceduralTextureSuite,
  isSoftwareGl: boolean,
): ShowroomStageRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  // 1. Expansive Monolithic Dark Gallery Floor (blends seamlessly into horizon fog)
  const floorGeo = new THREE.CircleGeometry(36, 72);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x09090c,
    roughness: 0.62,
    roughnessMap: textures.basaltRoughnessMap,
    metalness: 0.18,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  stageGroup.add(floorMesh);
  disposables.push(floorGeo, floorMat);

  // 2. Composite Multi-Part Obsidian Inspection Plinth (bottom-center flush with y=0)
  const plinthGroup = new THREE.Group();
  stageGroup.add(plinthGroup);

  // Tiered beveled basalt base via LatheGeometry
  const plinthPoints = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(1.52, 0.0),
    new THREE.Vector2(1.52, 0.06),
    new THREE.Vector2(1.44, 0.095),
    new THREE.Vector2(1.22, 0.095),
    new THREE.Vector2(1.22, 0.155),
    new THREE.Vector2(1.16, 0.19),
    new THREE.Vector2(0.001, 0.19),
  ];
  const plinthGeo = new THREE.LatheGeometry(plinthPoints, 64);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x111116,
    roughness: 0.72,
    roughnessMap: textures.basaltRoughnessMap,
    metalness: 0.14,
  });
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  plinthGroup.add(plinthMesh);
  disposables.push(plinthGeo, plinthMat);

  // Brushed Chrome Bezel Ring seated along upper plinth shoulder
  const chromeBezelGeo = new THREE.TorusGeometry(1.195, 0.013, 14, 72);
  const chromeBezelMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8d8df,
    metalness: 0.96,
    roughness: 0.16,
    anisotropy: 0.7,
    clearcoat: 0.4,
  });
  const chromeBezel = new THREE.Mesh(chromeBezelGeo, chromeBezelMat);
  chromeBezel.rotation.x = Math.PI / 2;
  chromeBezel.position.y = 0.188;
  plinthGroup.add(chromeBezel);
  disposables.push(chromeBezelGeo, chromeBezelMat);

  // Recessed Blood-Red Perimeter Glow Channel
  const crimsonChannelGeo = new THREE.TorusGeometry(1.47, 0.011, 12, 72);
  const crimsonChannelMat = new THREE.MeshStandardMaterial({
    color: 0xc81e2b,
    emissive: 0xdc1e2e,
    emissiveIntensity: 1.35,
    roughness: 0.3,
    metalness: 0.2,
  });
  const crimsonChannel = new THREE.Mesh(crimsonChannelGeo, crimsonChannelMat);
  crimsonChannel.rotation.x = Math.PI / 2;
  crimsonChannel.position.y = 0.075;
  plinthGroup.add(crimsonChannel);
  disposables.push(crimsonChannelGeo, crimsonChannelMat);

  // Architectural Etched Degree Dial Plane flush above floor around plinth
  const dialGeo = new THREE.PlaneGeometry(4.4, 4.4);
  const dialMat = new THREE.MeshBasicMaterial({
    map: textures.stageRingGraphicMap,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const dialMesh = new THREE.Mesh(dialGeo, dialMat);
  dialMesh.rotation.x = -Math.PI / 2;
  dialMesh.position.y = 0.022;
  stageGroup.add(dialMesh);
  disposables.push(dialGeo, dialMat);

  // Soft Radial Contact Shadow directly on top of plinth beneath suspended tee
  const shadowGeo = new THREE.PlaneGeometry(1.9, 1.45);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.196;
  plinthGroup.add(shadowMesh);
  disposables.push(shadowGeo, shadowMat);

  // Overhead Dark-Chrome Gallery Suspension Halo (architectural framing)
  const haloGeo = new THREE.TorusGeometry(2.15, 0.024, 14, 72);
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0x222228,
    metalness: 0.9,
    roughness: 0.26,
  });
  const overheadHalo = new THREE.Mesh(haloGeo, haloMat);
  overheadHalo.rotation.x = Math.PI / 2;
  overheadHalo.position.y = 3.1;
  stageGroup.add(overheadHalo);
  disposables.push(haloGeo, haloMat);

  // 3. Interactive 17-Garment 3D Showroom Ring
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const ringRadius = 6.2;
  const ringSlots: RingSlotItem[] = [];
  const raycastTargets: THREE.Object3D[] = [];

  // Shared geometries for all 17 ring monolith displays
  const frameOuterGeo = new THREE.BoxGeometry(1.44, 1.72, 0.045);
  const plateGeo = new THREE.PlaneGeometry(1.34, 1.34);
  const badgeGeo = new THREE.PlaneGeometry(0.32, 0.16);
  const beaconGeo = new THREE.BoxGeometry(1.18, 0.022, 0.045);
  const hitProxyGeo = new THREE.BoxGeometry(1.52, 1.82, 0.24);
  const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(
    frameOuterGeo,
    plateGeo,
    badgeGeo,
    beaconGeo,
    hitProxyGeo,
    hitProxyMat,
  );

  // Architectural floor track ring beneath the 17 monoliths
  const ringTrackGeo = new THREE.RingGeometry(ringRadius - 0.14, ringRadius + 0.14, 96);
  const ringTrackMat = new THREE.MeshBasicMaterial({
    color: 0x24242c,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringTrack = new THREE.Mesh(ringTrackGeo, ringTrackMat);
  ringTrack.rotation.x = -Math.PI / 2;
  ringTrack.position.y = 0.025;
  ringGroup.add(ringTrack);
  disposables.push(ringTrackGeo, ringTrackMat);

  const ringTextures: THREE.Texture[] = [];

  catalog.forEach((garment, idx) => {
    const angle = (idx / catalog.length) * Math.PI * 2 + Math.PI; // index 0 sits gently behind stage in stage view
    const slotGroup = new THREE.Group();
    const x = Math.sin(angle) * ringRadius;
    const z = Math.cos(angle) * ringRadius;
    const baseY = 1.28;
    slotGroup.position.set(x, baseY, z);
    // Face inward toward the center inspection plinth
    slotGroup.lookAt(0, baseY, 0);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x16161c,
      metalness: 0.84,
      roughness: 0.3,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    });
    const frameMesh = new THREE.Mesh(frameOuterGeo, frameMat);
    slotGroup.add(frameMesh);

    const plateMat = new THREE.MeshStandardMaterial({
      color: garment.baseColor === 'white' ? 0xe5e5e3 : 0x1b1b20,
      roughness: 0.72,
      metalness: 0.05,
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, 0.07, 0.028);
    slotGroup.add(plateMesh);

    const badgeTex = createIndexBadgeTexture(garment.indexLabel);
    const badgeMat = new THREE.MeshBasicMaterial({ map: badgeTex });
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0, -0.71, 0.028);
    slotGroup.add(badgeMesh);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x2c2c34,
      emissive: 0xc81e2b,
      emissiveIntensity: 0.0,
      roughness: 0.35,
      metalness: 0.5,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, -0.89, 0.0);
    slotGroup.add(beaconMesh);

    // Invisible simplified raycast proxy on layer 1
    const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxy.layers.set(1);
    hitProxy.userData.garmentId = garment.id;
    slotGroup.add(hitProxy);

    ringGroup.add(slotGroup);
    raycastTargets.push(hitProxy);
    disposables.push(frameMat, plateMat, badgeTex, badgeMat, beaconMat);

    ringSlots.push({
      garment,
      group: slotGroup,
      frameMat,
      plateMat,
      beaconMat,
      hitProxy,
      angle,
      baseY,
    });
  });

  // 4. Cinematic Studio Lighting Rig (Warm Key + Cool Hemi Fill + Crimson & Chrome Rims + Softboxes)
  const keyLight = new THREE.DirectionalLight(0xfff6ed, LIGHTING_PRESETS.obsidian.keyIntensity);
  keyLight.position.set(3.2, 5.2, 4.2);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 16;
  keyLight.shadow.camera.left = -2.4;
  keyLight.shadow.camera.right = 2.4;
  keyLight.shadow.camera.top = 2.6;
  keyLight.shadow.camera.bottom = -2.0;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const hemiLight = new THREE.HemisphereLight(
    0x9fb3c8,
    0x120a0d,
    LIGHTING_PRESETS.obsidian.hemiIntensity,
  );
  scene.add(hemiLight);

  // Front-left subtle cool fill so dark garments retain fold readability
  const fillLight = new THREE.DirectionalLight(0xcfd8e3, LIGHTING_PRESETS.obsidian.fillIntensity);
  fillLight.position.set(-3.8, 2.2, 3.2);
  scene.add(fillLight);

  // Blood-Red Cinematic Back-Left Rim Light
  const crimsonRim = new THREE.SpotLight(
    0xdc1e2e,
    LIGHTING_PRESETS.obsidian.crimsonRimIntensity * 6,
    18,
    Math.PI / 3.2,
    0.72,
    1.5,
  );
  crimsonRim.position.set(-3.2, 2.6, -3.4);
  crimsonRim.target.position.set(0, 1.15, 0);
  scene.add(crimsonRim, crimsonRim.target);

  // Crisp Chrome-Silver Back-Right Rim Light
  const chromeRim = new THREE.SpotLight(
    0xe4e8f5,
    LIGHTING_PRESETS.obsidian.chromeRimIntensity * 5,
    18,
    Math.PI / 3.0,
    0.7,
    1.5,
  );
  chromeRim.position.set(3.4, 2.8, -3.0);
  chromeRim.target.position.set(0, 1.15, 0);
  scene.add(chromeRim, chromeRim.target);

  // Studio Overhead Softboxes (RectAreaLight skipped on software WebGL)
  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    const softboxTop = new THREE.RectAreaLight(0xffffff, 2.4, 3.4, 1.2);
    softboxTop.position.set(0, 3.55, 0.65);
    softboxTop.lookAt(0, 1.1, 0);
    scene.add(softboxTop);

    const softboxBack = new THREE.RectAreaLight(0xdc2626, 1.3, 2.8, 0.9);
    softboxBack.position.set(0, 1.5, -2.8);
    softboxBack.lookAt(0, 1.1, 0);
    scene.add(softboxBack);
  }

  // Lighting damping targets
  let activeTarget: LightTargetValues = LIGHTING_PRESETS.obsidian;
  const currentKeyColor = LIGHTING_PRESETS.obsidian.keyColor.clone();
  const currentHemiSky = LIGHTING_PRESETS.obsidian.hemiSky.clone();

  const applyLightingPreset = (preset: LightingPreset) => {
    activeTarget = LIGHTING_PRESETS[preset];
  };

  const updateLightingDamp = (dt: number) => {
    const k = 1 - Math.exp(-5.0 * dt);
    keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, activeTarget.keyIntensity, k);
    currentKeyColor.lerp(activeTarget.keyColor, k);
    keyLight.color.copy(currentKeyColor);

    hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, activeTarget.hemiIntensity, k);
    currentHemiSky.lerp(activeTarget.hemiSky, k);
    hemiLight.color.copy(currentHemiSky);

    fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, activeTarget.fillIntensity, k);
    crimsonRim.intensity = THREE.MathUtils.lerp(
      crimsonRim.intensity,
      activeTarget.crimsonRimIntensity * 6,
      k,
    );
    chromeRim.intensity = THREE.MathUtils.lerp(
      chromeRim.intensity,
      activeTarget.chromeRimIntensity * 5,
      k,
    );
    crimsonChannelMat.emissiveIntensity = THREE.MathUtils.lerp(
      crimsonChannelMat.emissiveIntensity,
      activeTarget.plinthGlow,
      k,
    );
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      renderer.toneMappingExposure,
      activeTarget.exposure,
      k,
    );
  };

  let activeId = catalog[0]?.id ?? '';
  let hoveredId: string | null = null;

  const setActiveRingGarment = (garmentId: string, nextHoverId: string | null) => {
    activeId = garmentId;
    hoveredId = nextHoverId;
  };

  const setRingTexture = (
    garmentId: string,
    dataUrl: string,
    forceReplace = false,
  ) => {
    const slot = ringSlots.find((s) => s.garment.id === garmentId);
    if (!slot) return;
    if (!forceReplace && slot.plateMat.userData.lastSrc === dataUrl) return;
    slot.plateMat.userData.lastSrc = dataUrl;

    const img = new Image();
    img.onload = () => {
      // Ignore stale async loads if another update superseded this one
      if (slot.plateMat.userData.lastSrc !== dataUrl) return;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      // Dark gallery mat background inside monolith display
      ctx.fillStyle = '#0D0D11';
      ctx.fillRect(0, 0, 512, 512);
      // Subtle radial spotlight behind the garment
      const rad = ctx.createRadialGradient(256, 256, 30, 256, 256, 250);
      rad.addColorStop(0, 'rgba(255,255,255,0.08)');
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 24, 24, 464, 464);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;

      const prevTex = slot.plateMat.map;
      slot.plateMat.map = tex;
      slot.plateMat.color.setHex(0xffffff);
      slot.plateMat.needsUpdate = true;
      ringTextures.push(tex);
      if (prevTex) {
        prevTex.dispose();
      }
    };
    img.src = dataUrl;
  };

  const updateRingVisibility = (
    mode: 'stage' | 'ring',
    elapsed: number,
    dt: number,
  ) => {
    const k = 1 - Math.exp(-5.5 * dt);
    const targetTrackOpacity = mode === 'ring' ? 0.55 : 0.14;
    ringTrackMat.opacity = THREE.MathUtils.lerp(ringTrackMat.opacity, targetTrackOpacity, k);

    for (let i = 0; i < ringSlots.length; i++) {
      const slot = ringSlots[i];
      const isSelected = slot.garment.id === activeId;
      const isHovered = slot.garment.id === hoveredId;

      const targetScale =
        mode === 'ring' ? (isHovered ? 1.09 : isSelected ? 1.05 : 0.96) : 0.86;
      const nextScale = THREE.MathUtils.lerp(slot.group.scale.x, targetScale, k);
      slot.group.scale.setScalar(nextScale);

      const hoverLift = mode === 'ring' && isHovered ? 0.14 : isSelected && mode === 'ring' ? 0.08 : 0;
      const bob = Math.sin(elapsed * 0.9 + i * 0.45) * 0.025;
      slot.group.position.y = THREE.MathUtils.lerp(
        slot.group.position.y,
        slot.baseY + hoverLift + bob,
        k,
      );

      const targetBeacon = isHovered ? 2.4 : isSelected ? 1.65 : mode === 'ring' ? 0.15 : 0.0;
      slot.beaconMat.emissiveIntensity = THREE.MathUtils.lerp(
        slot.beaconMat.emissiveIntensity,
        targetBeacon,
        k,
      );

      const targetFrameEmissive = isHovered ? 0.42 : isSelected ? 0.22 : 0.0;
      slot.frameMat.emissive.setHex(isHovered || isSelected ? 0xc81e2b : 0x000000);
      slot.frameMat.emissiveIntensity = THREE.MathUtils.lerp(
        slot.frameMat.emissiveIntensity,
        targetFrameEmissive,
        k,
      );
    }
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
    ringTextures.forEach((t) => t.dispose());
  };

  return {
    stageGroup,
    ringGroup,
    ringSlots,
    raycastTargets,
    applyLightingPreset,
    updateLightingDamp,
    setActiveRingGarment,
    setRingTexture,
    updateRingVisibility,
    dispose,
  };
}
