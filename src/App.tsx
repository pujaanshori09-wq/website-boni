import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GARMENT_CATALOG,
  GarmentProduct,
  GarmentSize,
} from './data/catalog';
import {
  CameraPreset,
  ShowroomCanvas,
  ShowroomMode,
} from './components/ShowroomCanvas';
import { TopBar } from './components/TopBar';
import { ControlDock } from './components/ControlDock';
import { CollectionDrawer } from './components/CollectionDrawer';
import { SizeGuideModal } from './components/SizeGuideModal';
import { CartCheckoutDrawer, CartItem } from './components/CartCheckoutDrawer';
import { ArtworkManagerPanel } from './components/ArtworkManagerPanel';
import { LightingPreset } from './three/showroomStage';
import { GarmentThumbPair } from './utils/pdfArtworkPipeline';
import {
  createDefaultOverride,
  deleteArtworkOverride,
  GarmentArtworkOverride,
  hasCustomizations,
  loadAllArtworkOverrides,
  saveArtworkOverride,
} from './utils/artworkStorage';

const CART_STORAGE_KEY = 'penance_pierce_bag_v1';

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.garmentId === 'string' &&
        typeof entry.size === 'string' &&
        typeof entry.quantity === 'number' &&
        entry.quantity > 0,
    );
  } catch {
    return [];
  }
}

export default function App() {
  const [activeGarmentId, setActiveGarmentId] = useState<string>(
    GARMENT_CATALOG[0].id,
  );
  const [selectedSize, setSelectedSize] = useState<GarmentSize>('L');
  const [mode, setMode] = useState<ShowroomMode>('stage');
  const [cameraCommand, setCameraCommand] = useState<{
    preset: CameraPreset;
    seq: number;
  }>({ preset: 'front', seq: 0 });
  const [autoSpin, setAutoSpin] = useState<boolean>(false);
  const [lightingPreset, setLightingPreset] =
    useState<LightingPreset>('obsidian');
  const [showSuspension, setShowSuspension] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isLoadingArtwork, setIsLoadingArtwork] = useState<boolean>(true);

  const [collectionOpen, setCollectionOpen] = useState<boolean>(false);
  const [collectionVariant, setCollectionVariant] = useState<
    'collection' | 'lookbook'
  >('collection');
  const [sizeGuideOpen, setSizeGuideOpen] = useState<boolean>(false);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [artworkManagerOpen, setArtworkManagerOpen] = useState<boolean>(false);

  const [artworkOverrides, setArtworkOverrides] = useState<
    Record<string, GarmentArtworkOverride>
  >({});
  const [overridesHydrated, setOverridesHydrated] = useState<boolean>(false);

  const [cartItems, setCartItems] = useState<CartItem[]>(loadInitialCart);
  const [thumbnails, setThumbnails] = useState<Record<string, GarmentThumbPair>>(
    {},
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const saveTimersRef = useRef<Record<string, number>>({});

  const activeGarment = useMemo(
    () =>
      GARMENT_CATALOG.find((g) => g.id === activeGarmentId) ??
      GARMENT_CATALOG[0],
    [activeGarmentId],
  );

  const activeHasCustomArtwork = useMemo(
    () =>
      hasCustomizations(
        artworkOverrides[activeGarment.id],
        activeGarment.baseColor === 'brown',
      ),
    [artworkOverrides, activeGarment],
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  // Hydrate all saved custom PNG artworks & settings from browser IndexedDB on mount
  useEffect(() => {
    let active = true;
    loadAllArtworkOverrides()
      .then((saved) => {
        if (!active) return;
        setArtworkOverrides(saved);
        setOverridesHydrated(true);
      })
      .catch(() => {
        if (active) setOverridesHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist shopping bag in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [cartItems]);

  // Auto-dismiss subtle confirmation toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Allow live replacement of thumbnails whenever custom artwork or base color changes
  const handleThumbReady = useCallback(
    (garmentId: string, frontThumbUrl: string, backThumbUrl: string) => {
      setThumbnails((prev) => {
        const existing = prev[garmentId];
        if (
          existing &&
          existing.frontThumbUrl === frontThumbUrl &&
          existing.backThumbUrl === backThumbUrl
        ) {
          return prev;
        }
        return { ...prev, [garmentId]: { frontThumbUrl, backThumbUrl } };
      });
    },
    [],
  );

  const issueCameraCommand = useCallback((preset: CameraPreset) => {
    setCameraCommand((prev) => ({ preset, seq: prev.seq + 1 }));
  }, []);

  const handleSelectGarment = useCallback(
    (garmentId: string) => {
      setActiveGarmentId(garmentId);
      setCollectionOpen(false);
      setMode('stage');
      issueCameraCommand('front');
    },
    [issueCameraCommand],
  );

  const handleStepGarment = useCallback(
    (dir: -1 | 1) => {
      const idx = GARMENT_CATALOG.findIndex((g) => g.id === activeGarmentId);
      const nextIdx =
        (idx + dir + GARMENT_CATALOG.length) % GARMENT_CATALOG.length;
      setActiveGarmentId(GARMENT_CATALOG[nextIdx].id);
    },
    [activeGarmentId],
  );

  const handleToggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ShowroomMode = prev === 'stage' ? 'ring' : 'stage';
      issueCameraCommand(next === 'ring' ? 'ring' : 'front');
      return next;
    });
  }, [issueCameraCommand]);

  const handleCameraPreset = useCallback(
    (preset: CameraPreset) => {
      if (mode === 'ring' && preset !== 'ring') {
        setMode('stage');
      }
      issueCameraCommand(preset);
    },
    [mode, issueCameraCommand],
  );

  const handleUpdateArtworkOverride = useCallback(
    (
      garmentId: string,
      updater: (prev: GarmentArtworkOverride) => GarmentArtworkOverride,
    ) => {
      const garmentMeta = GARMENT_CATALOG.find((g) => g.id === garmentId);
      const defaultWashed = garmentMeta?.baseColor === 'brown';

      setArtworkOverrides((prevMap) => {
        const current =
          prevMap[garmentId] ?? createDefaultOverride(garmentId, defaultWashed);
        const updated = { ...updater(current), garmentId, updatedAt: Date.now() };

        // Debounce IndexedDB writes cleanly during slider drags
        const existingTimer = saveTimersRef.current[garmentId];
        if (existingTimer) window.clearTimeout(existingTimer);
        saveTimersRef.current[garmentId] = window.setTimeout(() => {
          void saveArtworkOverride(updated).catch(() => undefined);
        }, 120);

        return { ...prevMap, [garmentId]: updated };
      });
    },
    [],
  );

  const handleResetGarmentArtwork = useCallback((garmentId: string) => {
    const existingTimer = saveTimersRef.current[garmentId];
    if (existingTimer) window.clearTimeout(existingTimer);

    setArtworkOverrides((prevMap) => {
      const next = { ...prevMap };
      delete next[garmentId];
      return next;
    });
    void deleteArtworkOverride(garmentId).catch(() => undefined);
    setToastMessage('Reset tee artwork to original PDF catalog');
  }, []);

  const handleAddToBag = useCallback(
    (garment: GarmentProduct = activeGarment) => {
      setCartItems((prev) => {
        const idx = prev.findIndex(
          (item) => item.garmentId === garment.id && item.size === selectedSize,
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            quantity: updated[idx].quantity + 1,
          };
          return updated;
        }
        return [
          ...prev,
          { garmentId: garment.id, size: selectedSize, quantity: 1 },
        ];
      });
      setToastMessage(`Added ${garment.name} (${selectedSize}) to Bag`);
    },
    [activeGarment, selectedSize],
  );

  const handleUpdateQty = useCallback(
    (garmentId: string, size: GarmentSize, delta: number) => {
      setCartItems((prev) =>
        prev
          .map((item) =>
            item.garmentId === garmentId && item.size === size
              ? { ...item, quantity: item.quantity + delta }
              : item,
          )
          .filter((item) => item.quantity > 0),
      );
    },
    [],
  );

  const handleRemoveItem = useCallback(
    (garmentId: string, size: GarmentSize) => {
      setCartItems((prev) =>
        prev.filter(
          (item) => !(item.garmentId === garmentId && item.size === size),
        ),
      );
    },
    [],
  );

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // Keyboard shortcuts for fluid gallery navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setCollectionOpen(false);
        setSizeGuideOpen(false);
        setCartOpen(false);
        setArtworkManagerOpen(false);
        return;
      }

      if (collectionOpen || sizeGuideOpen || cartOpen) return;

      if (e.key === 'ArrowRight') {
        handleStepGarment(1);
      } else if (e.key === 'ArrowLeft') {
        handleStepGarment(-1);
      } else if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key.toLowerCase() === 'r') {
        handleToggleMode();
      } else if (e.key.toLowerCase() === 'f') {
        handleCameraPreset('front');
      } else if (e.key.toLowerCase() === 'b') {
        handleCameraPreset('back');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    collectionOpen,
    sizeGuideOpen,
    cartOpen,
    handleStepGarment,
    handleToggleMode,
    handleCameraPreset,
  ]);

  const activeNavView = sizeGuideOpen
    ? 'sizing'
    : collectionOpen
      ? collectionVariant
      : 'showroom';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070709] text-[#F5F5F4]">
      {/* Full-Bleed Unobstructed 3D Showroom Canvas */}
      <ShowroomCanvas
        activeGarment={activeGarment}
        artworkOverrides={artworkOverrides}
        overridesHydrated={overridesHydrated}
        mode={mode}
        cameraCommand={cameraCommand}
        autoSpin={autoSpin}
        lightingPreset={lightingPreset}
        showSuspension={showSuspension}
        onSelectGarment={handleSelectGarment}
        onLoadingChange={setIsLoadingArtwork}
        onThumbReady={handleThumbReady}
      />

      {/* Minimal 3-Zone Top Navigation Bar */}
      <TopBar
        activeView={activeNavView}
        cartCount={cartCount}
        onSelectShowroom={() => {
          setCollectionOpen(false);
          setSizeGuideOpen(false);
          setCartOpen(false);
        }}
        onOpenCollection={() => {
          setSizeGuideOpen(false);
          setCartOpen(false);
          setArtworkManagerOpen(false);
          setCollectionVariant('collection');
          setCollectionOpen(true);
        }}
        onOpenLookbook={() => {
          setSizeGuideOpen(false);
          setCartOpen(false);
          setArtworkManagerOpen(false);
          setCollectionVariant('lookbook');
          setCollectionOpen(true);
        }}
        onOpenSizing={() => {
          setCollectionOpen(false);
          setCartOpen(false);
          setSizeGuideOpen(true);
        }}
        onOpenCart={() => {
          setCollectionOpen(false);
          setSizeGuideOpen(false);
          setArtworkManagerOpen(false);
          setCartOpen(true);
        }}
      />

      {/* Subtle Non-Intrusive Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 sm:right-8 z-40 flex items-center gap-3 px-4 py-2.5 bg-[#121218] border border-[#C81E2B] shadow-2xl text-xs text-[#F5F5F4]"
        >
          <span>{toastMessage}</span>
          {toastMessage.startsWith('Added') && (
            <button
              type="button"
              onClick={() => {
                setToastMessage(null);
                setCartOpen(true);
              }}
              className="font-semibold uppercase tracking-wider text-[#E11D2E] hover:text-white underline underline-offset-4"
            >
              View Bag
            </button>
          )}
        </div>
      )}

      {/* Collapsible Catalog Artwork Manager (Live 3D Preview + IndexedDB Persistence) */}
      <ArtworkManagerPanel
        open={artworkManagerOpen}
        activeGarment={activeGarment}
        overrides={artworkOverrides}
        onClose={() => setArtworkManagerOpen(false)}
        onSelectGarment={handleSelectGarment}
        onPrevGarment={() => handleStepGarment(-1)}
        onNextGarment={() => handleStepGarment(1)}
        onUpdateOverride={handleUpdateArtworkOverride}
        onResetGarment={handleResetGarmentArtwork}
        onFocusSide={(side) => handleCameraPreset(side)}
      />

      {/* Unified Collapsible Bottom Control Dock */}
      <ControlDock
        garment={activeGarment}
        totalCount={GARMENT_CATALOG.length}
        selectedSize={selectedSize}
        mode={mode}
        autoSpin={autoSpin}
        lightingPreset={lightingPreset}
        showSuspension={showSuspension}
        isLoadingArtwork={isLoadingArtwork}
        collapsed={dockCollapsed}
        artworkManagerOpen={artworkManagerOpen}
        hasCustomArtwork={activeHasCustomArtwork}
        onToggleCollapsed={() => setDockCollapsed((prev) => !prev)}
        onToggleArtworkManager={() => {
          setCollectionOpen(false);
          setCartOpen(false);
          setSizeGuideOpen(false);
          setArtworkManagerOpen((prev) => !prev);
        }}
        onPrevGarment={() => handleStepGarment(-1)}
        onNextGarment={() => handleStepGarment(1)}
        onSelectSize={setSelectedSize}
        onAddToBag={() => handleAddToBag(activeGarment)}
        onCameraPreset={handleCameraPreset}
        onToggleMode={handleToggleMode}
        onToggleAutoSpin={() => setAutoSpin((prev) => !prev)}
        onSelectLighting={setLightingPreset}
        onToggleSuspension={() => setShowSuspension((prev) => !prev)}
        onOpenCollection={() => {
          setArtworkManagerOpen(false);
          setCollectionVariant('collection');
          setCollectionOpen(true);
        }}
        onOpenSizing={() => setSizeGuideOpen(true)}
      />

      {/* Slide-Over 17-Piece Collection & Lookbook Drawer */}
      <CollectionDrawer
        open={collectionOpen}
        variant={collectionVariant}
        activeGarmentId={activeGarment.id}
        selectedSize={selectedSize}
        thumbnails={thumbnails}
        artworkOverrides={artworkOverrides}
        onThumbReady={handleThumbReady}
        onClose={() => setCollectionOpen(false)}
        onInspectGarment={handleSelectGarment}
        onQuickAdd={(g) => handleAddToBag(g)}
        onSwitchVariant={setCollectionVariant}
      />

      {/* Heavyweight 280GSM Boxy Fit Size Guide Modal */}
      <SizeGuideModal
        open={sizeGuideOpen}
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
        onClose={() => setSizeGuideOpen(false)}
      />

      {/* Persistent Shopping Bag & Express Checkout Drawer */}
      <CartCheckoutDrawer
        open={cartOpen}
        items={cartItems}
        thumbnails={thumbnails}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOpenCollection={() => {
          setCollectionVariant('collection');
          setCollectionOpen(true);
        }}
      />
    </div>
  );
}
