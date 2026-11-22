import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GARMENT_CATALOG, GarmentProduct } from '../data/catalog';
import { createProceduralTextureSuite } from '../three/fabricTextures';
import { createSculptedTeeRig, SculptedTeeRig } from '../three/garmentGeometry';
import {
  createShowroomStage,
  LightingPreset,
  ShowroomStageRig,
} from '../three/showroomStage';
import {
  BakedGarmentAssets,
  disposeBakedGarmentAssets,
  loadGarment3DAssets,
  loadGarmentThumbnails,
} from '../utils/pdfArtworkPipeline';
import { GarmentArtworkOverride } from '../utils/artworkStorage';

export type CameraPreset = 'front' | 'back' | 'macro' | 'ring';
export type ShowroomMode = 'stage' | 'ring';

export interface ShowroomCanvasProps {
  activeGarment: GarmentProduct;
  artworkOverrides: Record<string, GarmentArtworkOverride>;
  overridesHydrated: boolean;
  mode: ShowroomMode;
  cameraCommand: { preset: CameraPreset; seq: number };
  autoSpin: boolean;
  lightingPreset: LightingPreset;
  showSuspension: boolean;
  onSelectGarment: (garmentId: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onThumbReady?: (garmentId: string, frontUrl: string, backUrl: string) => void;
}

// Pre-allocated scratch vectors at module scope (zero GC inside animation loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const ShowroomCanvas: React.FC<ShowroomCanvasProps> = ({
  activeGarment,
  artworkOverrides,
  overridesHydrated,
  mode,
  cameraCommand,
  autoSpin,
  lightingPreset,
  showSuspension,
  onSelectGarment,
  onLoadingChange,
  onThumbReady,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [hoveredRingItem, setHoveredRingItem] = useState<{
    garment: GarmentProduct;
    x: number;
    y: number;
  } | null>(null);

  // Refs synced from React props so the WebGL loop never tears down on UI state changes
  const modeRef = useRef<ShowroomMode>(mode);
  const autoSpinRef = useRef<boolean>(autoSpin);
  const activeGarmentRef = useRef<GarmentProduct>(activeGarment);
  const hoveredIdRef = useRef<string | null>(null);
  const activeAssetsRef = useRef<BakedGarmentAssets | null>(null);
  const onSelectRef = useRef(onSelectGarment);
  const onLoadingRef = useRef(onLoadingChange);
  const onThumbReadyRef = useRef(onThumbReady);

  modeRef.current = mode;
  autoSpinRef.current = autoSpin;
  activeGarmentRef.current = activeGarment;
  onSelectRef.current = onSelectGarment;
  onLoadingRef.current = onLoadingChange;
  onThumbReadyRef.current = onThumbReady;

  // Imperative handles created inside the one-time mount effect
  const rigRef = useRef<{
    teeRig: SculptedTeeRig;
    stageRig: ShowroomStageRig;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    startCameraPreset: (preset: CameraPreset) => void;
    triggerSwapPulse: () => void;
    setMacroState: (isMacro: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070709);
    scene.fog = new THREE.FogExp2(0x070709, 0.048);

    // Mandatory RoomEnvironment studio reflections on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      80,
    );
    camera.position.set(0, 1.24, 3.65);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.12, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 0.95;
    controls.maxDistance = 12.2;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.535;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.85;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.6;
    controls.update();

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const proceduralTextures = createProceduralTextureSuite(maxAnisotropy);
    const teeRig = createSculptedTeeRig(proceduralTextures);
    scene.add(teeRig.root);

    const stageRig = createShowroomStage(
      scene,
      renderer,
      GARMENT_CATALOG,
      proceduralTextures,
      isSoftwareGl,
    );
    stageRig.setActiveRingGarment(activeGarmentRef.current.id, null);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Camera transition state
    let camTransitionActive = false;
    let isMacroActive = false;
    let swapPulse = 0;

    const startCameraPreset = (preset: CameraPreset) => {
      camTransitionActive = true;
      isMacroActive = preset === 'macro';

      const aspect = camera.aspect;
      const mobileScale = aspect < 0.85 ? 1.26 : 1.0;

      if (preset === 'front') {
        _camGoalPos.set(0, 1.22, 3.6 * mobileScale);
        _camGoalTarget.set(0, 1.12, 0);
      } else if (preset === 'back') {
        _camGoalPos.set(0, 1.22, -3.6 * mobileScale);
        _camGoalTarget.set(0, 1.12, 0);
      } else if (preset === 'macro') {
        // Zoom closely onto whichever side the user is currently facing (front or back)
        const facingBack = camera.position.z < 0;
        _camGoalPos.set(0, 1.22, (facingBack ? -1.48 : 1.48) * mobileScale);
        _camGoalTarget.set(0, 1.18, 0);
      } else if (preset === 'ring') {
        _camGoalPos.set(0, 3.85, 10.2 * Math.min(1.18, mobileScale));
        _camGoalTarget.set(0, 1.15, 0);
      }
    };

    const triggerSwapPulse = () => {
      swapPulse = 1.0;
    };

    const setMacroState = (m: boolean) => {
      isMacroActive = m;
    };

    // Cancel camera preset transitions the instant user takes manual control
    const handleControlStart = () => {
      camTransitionActive = false;
    };
    controls.addEventListener('start', handleControlStart);

    // Raycaster strictly on layer 1 (3D Showroom Ring proxies)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    let pointerDownPos = { x: 0, y: 0 };
    let lastRaycastMs = 0;

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastMs < 40) return;
      lastRaycastMs = now;

      if (modeRef.current !== 'ring') {
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          stageRig.setActiveRingGarment(activeGarmentRef.current.id, null);
          renderer.domElement.style.cursor = 'grab';
          setHoveredRingItem(null);
        }
        return;
      }

      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(stageRig.raycastTargets, false);

      if (hits.length > 0) {
        const hitId = hits[0].object.userData.garmentId as string;
        hoveredIdRef.current = hitId;
        stageRig.setActiveRingGarment(activeGarmentRef.current.id, hitId);
        renderer.domElement.style.cursor = 'pointer';
        const found = GARMENT_CATALOG.find((g) => g.id === hitId);
        if (found) {
          setHoveredRingItem({ garment: found, x: e.clientX, y: e.clientY });
        }
      } else {
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          stageRig.setActiveRingGarment(activeGarmentRef.current.id, null);
          renderer.domElement.style.cursor = 'grab';
          setHoveredRingItem(null);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 36) return; // Ignore orbit drags

      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(stageRig.raycastTargets, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.garmentId as string;
        if (hitId) {
          setHoveredRingItem(null);
          onSelectRef.current(hitId);
        }
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    rigRef.current = {
      teeRig,
      stageRig,
      renderer,
      camera,
      controls,
      startCameraPreset,
      triggerSwapPulse,
      setMacroState,
    };

    // Animation loop (hardware rAF vs software WebGL afterDraw pacing)
    let cancelled = false;
    let frameId = 0;
    let lastTime = performance.now();
    const startTime = lastTime;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (cancelled) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (cancelled) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      const elapsed = (now - startTime) / 1000;
      lastTime = now;

      // Exponentially damped camera preset transitions
      if (camTransitionActive) {
        const k = 1 - Math.exp(-5.8 * dt);
        camera.position.lerp(_camGoalPos, k);
        controls.target.lerp(_camGoalTarget, k);
        if (
          camera.position.distanceToSquared(_camGoalPos) < 0.0004 &&
          controls.target.distanceToSquared(_camGoalTarget) < 0.0004
        ) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          camTransitionActive = false;
        }
      }

      controls.autoRotate = !isSoftwareGl && autoSpinRef.current && !camTransitionActive;
      controls.update();

      // Subtle garment swap pulse animation
      if (swapPulse > 0.001) {
        swapPulse = Math.max(0, swapPulse - dt * 3.4);
        const eased = Math.sin(swapPulse * Math.PI);
        teeRig.garmentGroup.scale.setScalar(1.0 - eased * 0.035);
      } else {
        teeRig.garmentGroup.scale.setScalar(1.0);
      }

      teeRig.updateIdleMotion(elapsed, isMacroActive || camera.position.length() < 2.0);
      stageRig.updateLightingDamp(dt);
      stageRig.updateRingVisibility(modeRef.current, elapsed, dt);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Apply initial aspect-aware framing on mount
    startCameraPreset('front');
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', handleControlStart);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      disposeBakedGarmentAssets(activeAssetsRef.current);
      activeAssetsRef.current = null;
      controls.dispose();
      teeRig.dispose();
      stageRig.dispose();
      proceduralTextures.dispose();
      envTex.dispose();
      renderer.dispose();
      rigRef.current = null;
    };
  }, []);

  // Hydrate all 17 3D Showroom Ring frames once IndexedDB overrides finish loading
  const ringHydratedOnceRef = useRef(false);
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig || !overridesHydrated || ringHydratedOnceRef.current) return;
    ringHydratedOnceRef.current = true;

    let cancelled = false;
    const populateAllRingFrames = async () => {
      for (const item of GARMENT_CATALOG) {
        if (cancelled) return;
        try {
          const thumbs = await loadGarmentThumbnails(
            item,
            artworkOverrides[item.id],
          );
          if (cancelled) return;
          rig.stageRig.setRingTexture(item.id, thumbs.frontThumbUrl, true);
          onThumbReadyRef.current?.(
            item.id,
            thumbs.frontThumbUrl,
            thumbs.backThumbUrl,
          );
        } catch {
          // Continue populating remaining items
        }
      }
    };
    void populateAllRingFrames();
    return () => {
      cancelled = true;
    };
  }, [overridesHydrated, artworkOverrides]);

  // Trigger swap pulse only when switching between different garments (not on slider drags!)
  const prevGarmentIdRef = useRef<string>(activeGarment.id);
  const activeOverride = artworkOverrides[activeGarment.id];

  // Bake high-resolution 3D PBR textures & update 3D Ring frame whenever activeGarment or its override changes
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig || !overridesHydrated) return;

    let stale = false;
    const isGarmentSwitch = prevGarmentIdRef.current !== activeGarment.id;
    prevGarmentIdRef.current = activeGarment.id;

    rig.stageRig.setActiveRingGarment(activeGarment.id, hoveredIdRef.current);
    if (isGarmentSwitch) {
      rig.teeRig.setBasePreviewColor(
        activeOverride?.baseHex ?? activeGarment.baseHex,
      );
      rig.triggerSwapPulse();
      onLoadingRef.current(true);
    }

    const maxAniso = Math.min(8, rig.renderer.capabilities.getMaxAnisotropy());
    // Light debounce when dragging scale/offset sliders so canvas updates feel buttery smooth
    const delayMs = isGarmentSwitch ? 0 : 45;

    const timer = window.setTimeout(() => {
      loadGarment3DAssets(activeGarment, maxAniso, activeOverride)
        .then((assets) => {
          if (stale) {
            disposeBakedGarmentAssets(assets);
            return;
          }
          const prevAssets = activeAssetsRef.current;
          rig.teeRig.applyGarmentAssets(activeGarment, assets);
          activeAssetsRef.current = assets;
          if (prevAssets) {
            disposeBakedGarmentAssets(prevAssets);
          }

          rig.stageRig.setRingTexture(
            activeGarment.id,
            assets.frontThumbUrl,
            true,
          );
          onThumbReadyRef.current?.(
            activeGarment.id,
            assets.frontThumbUrl,
            assets.backThumbUrl,
          );
          onLoadingRef.current(false);
        })
        .catch(() => {
          if (!stale) onLoadingRef.current(false);
        });
    }, delayMs);

    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [activeGarment, activeOverride, overridesHydrated]);

  // Apply lighting preset changes smoothly
  useEffect(() => {
    rigRef.current?.stageRig.applyLightingPreset(lightingPreset);
  }, [lightingPreset]);

  // Toggle chrome suspension hardware visibility
  useEffect(() => {
    rigRef.current?.teeRig.setSuspensionVisible(showSuspension);
  }, [showSuspension]);

  // Execute camera preset commands
  useEffect(() => {
    if (!rigRef.current) return;
    rigRef.current.startCameraPreset(cameraCommand.preset);
  }, [cameraCommand]);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#070709]">
      {/* Isolated WebGL mount container */}
      <div
        ref={mountRef}
        className="w-full h-full"
        aria-label={`Interactive 3D showroom displaying PENANCE PIERCE ${activeGarment.name}`}
      />

      {/* Hover Tooltip when pointing at a garment in 3D Showroom Ring mode */}
      {hoveredRingItem && mode === 'ring' && (
        <div
          className="fixed z-20 pointer-events-none px-3.5 py-2 bg-[#111115]/95 border border-white/15 shadow-2xl"
          style={{
            left: Math.min(window.innerWidth - 220, hoveredRingItem.x + 16),
            top: Math.max(76, hoveredRingItem.y - 24),
          }}
        >
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-[#A1A1AA]">
            <span className="text-[#E11D2E]">{hoveredRingItem.garment.indexLabel}</span>
            <span>·</span>
            <span>{hoveredRingItem.garment.colorLabel}</span>
          </div>
          <div className="text-sm font-display font-semibold text-[#F5F5F4] tracking-wide mt-0.5">
            {hoveredRingItem.garment.name}
          </div>
          <div className="text-xs font-mono-tabular text-[#D4D4D8] mt-0.5">
            ${hoveredRingItem.garment.priceUsd} USD · Click to inspect
          </div>
        </div>
      )}

      {/* WebGL unavailable or context lost graceful fallback */}
      {(webglUnavailable || contextLost) && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070709] p-6">
          <div className="max-w-md border border-white/15 bg-[#111115] p-6 text-center">
            <h2 className="font-display text-lg text-[#F5F5F4] tracking-wider">
              {contextLost ? '3D Context Restoring' : '3D Viewport Unavailable'}
            </h2>
            <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">
              {contextLost
                ? 'Your graphics context paused briefly. The PENANCE PIERCE showroom will resume automatically.'
                : 'WebGL is unavailable on this browser. You can still explore all 17 original PENANCE PIERCE designs via the Collection drawer.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
