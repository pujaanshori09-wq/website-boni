export interface GarmentArtworkOverride {
  garmentId: string;
  frontPngDataUrl: string | null;
  backPngDataUrl: string | null;
  frontScale: number; // 0.4 .. 1.45 (1.0 = default fit)
  frontOffsetY: number; // -0.25 .. +0.25 (0.0 = default chest center)
  backScale: number; // 0.4 .. 1.45
  backOffsetY: number; // -0.25 .. +0.25
  baseHex: string | null; // null = use original catalog/PDF fabric color
  washedEffect: boolean;
  updatedAt: number;
}

export const FABRIC_SWATCH_PRESETS: Array<{
  id: string;
  label: string;
  hex: string;
  defaultWashed?: boolean;
}> = [
  { id: 'matte-black', label: 'Matte Black', hex: '#101012' },
  { id: 'charcoal-wash', label: 'Charcoal Wash', hex: '#1E1E24', defaultWashed: true },
  { id: 'washed-espresso', label: 'Washed Espresso', hex: '#2D2118', defaultWashed: true },
  { id: 'off-white', label: 'Off-White', hex: '#F2F1EC' },
  { id: 'vintage-bone', label: 'Vintage Bone', hex: '#E5E0D5', defaultWashed: true },
  { id: 'oxblood-noir', label: 'Oxblood Noir', hex: '#261316', defaultWashed: true },
];

export function createDefaultOverride(
  garmentId: string,
  defaultWashed = false,
): GarmentArtworkOverride {
  return {
    garmentId,
    frontPngDataUrl: null,
    backPngDataUrl: null,
    frontScale: 1.0,
    frontOffsetY: 0.0,
    backScale: 1.0,
    backOffsetY: 0.0,
    baseHex: null,
    washedEffect: defaultWashed,
    updatedAt: 0,
  };
}

export function hasCustomizations(
  override: GarmentArtworkOverride | undefined,
  defaultWashed = false,
): boolean {
  if (!override) return false;
  return (
    override.frontPngDataUrl !== null ||
    override.backPngDataUrl !== null ||
    override.baseHex !== null ||
    override.washedEffect !== defaultWashed ||
    Math.abs(override.frontScale - 1.0) > 0.005 ||
    Math.abs(override.frontOffsetY) > 0.005 ||
    Math.abs(override.backScale - 1.0) > 0.005 ||
    Math.abs(override.backOffsetY) > 0.005
  );
}

const DB_NAME = 'penance_pierce_showroom_db';
const DB_VERSION = 1;
const STORE_NAME = 'garment_artwork_overrides';

let dbPromise: Promise<IDBDatabase> | null = null;

function openArtworkDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'garmentId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB.'));
    };
  });

  return dbPromise;
}

export async function loadAllArtworkOverrides(): Promise<
  Record<string, GarmentArtworkOverride>
> {
  try {
    const db = await openArtworkDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const result: Record<string, GarmentArtworkOverride> = {};
        const rows = (req.result || []) as GarmentArtworkOverride[];
        for (const row of rows) {
          if (row && typeof row.garmentId === 'string') {
            result[row.garmentId] = row;
          }
        }
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveArtworkOverride(
  override: GarmentArtworkOverride,
): Promise<void> {
  const db = await openArtworkDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...override, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteArtworkOverride(garmentId: string): Promise<void> {
  const db = await openArtworkDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(garmentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllArtworkOverrides(): Promise<void> {
  const db = await openArtworkDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Reads an uploaded PNG/WebP/JPEG File as a Data URL and downscales cleanly if
 * gigantic (> 2048px) so IndexedDB stays fast and crisp without lag.
 */
export async function readArtworkFileAsDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read uploaded image file.'));
    reader.readAsDataURL(file);
  });

  // Preserve transparency and cap max dimension at 1600px for crisp, snappy baking
  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(rawDataUrl);
        return;
      }
      const scale = maxDim / Math.max(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}
