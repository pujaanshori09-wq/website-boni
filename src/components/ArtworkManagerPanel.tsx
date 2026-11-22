import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { GARMENT_CATALOG, GarmentProduct } from '../data/catalog';
import {
  createDefaultOverride,
  FABRIC_SWATCH_PRESETS,
  GarmentArtworkOverride,
  hasCustomizations,
  readArtworkFileAsDataUrl,
} from '../utils/artworkStorage';

export interface ArtworkManagerPanelProps {
  open: boolean;
  activeGarment: GarmentProduct;
  overrides: Record<string, GarmentArtworkOverride>;
  onClose: () => void;
  onSelectGarment: (garmentId: string) => void;
  onPrevGarment: () => void;
  onNextGarment: () => void;
  onUpdateOverride: (
    garmentId: string,
    updater: (prev: GarmentArtworkOverride) => GarmentArtworkOverride,
  ) => void;
  onResetGarment: (garmentId: string) => void;
  onFocusSide: (side: 'front' | 'back') => void;
}

export const ArtworkManagerPanel: React.FC<ArtworkManagerPanelProps> = ({
  open,
  activeGarment,
  overrides,
  onClose,
  onSelectGarment,
  onPrevGarment,
  onNextGarment,
  onUpdateOverride,
  onResetGarment,
  onFocusSide,
}) => {
  const [editSide, setEditSide] = useState<'front' | 'back'>('front');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const defaultWashed = activeGarment.baseColor === 'brown';
  const current: GarmentArtworkOverride =
    overrides[activeGarment.id] ??
    createDefaultOverride(activeGarment.id, defaultWashed);

  const activePngUrl =
    editSide === 'front' ? current.frontPngDataUrl : current.backPngDataUrl;
  const activeScale =
    editSide === 'front' ? current.frontScale : current.backScale;
  const activeOffsetY =
    editSide === 'front' ? current.frontOffsetY : current.backOffsetY;

  const isCustomized = hasCustomizations(current, defaultWashed);
  const totalCustomizedCount = GARMENT_CATALOG.filter((g) =>
    hasCustomizations(overrides[g.id], g.baseColor === 'brown'),
  ).length;

  const handleSideSwitch = (side: 'front' | 'back') => {
    setEditSide(side);
    setUploadError(null);
    onFocusSide(side);
  };

  const processFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload a PNG, WebP, or JPEG image file.');
      return;
    }
    setUploadError(null);
    try {
      const dataUrl = await readArtworkFileAsDataUrl(file);
      onUpdateOverride(activeGarment.id, (prev) => ({
        ...prev,
        ...(editSide === 'front'
          ? { frontPngDataUrl: dataUrl }
          : { backPngDataUrl: dataUrl }),
      }));
      onFocusSide(editSide);
    } catch {
      setUploadError('Could not process that image. Try another PNG file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    void processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    void processFile(file);
  };

  const activeHexDisplay = current.baseHex ?? activeGarment.baseHex;

  return (
    <aside
      aria-label="Catalog Artwork Manager"
      className="fixed top-14 sm:top-16 right-0 bottom-0 z-30 w-full sm:w-[376px] bg-[#0B0B0F]/96 border-l border-white/15 shadow-[-18px_0_48px_rgba(0,0,0,0.85)] flex flex-col"
    >
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[#A1A1AA]">
            <SlidersHorizontal className="w-3 h-3 text-[#E11D2E]" aria-hidden="true" />
            <span>CATALOG ARTWORK MANAGER</span>
          </div>
          <h2 className="mt-0.5 font-display text-base font-semibold tracking-wider text-[#F5F5F4] truncate">
            {activeGarment.indexLabel}. {activeGarment.name}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Artwork Manager"
          className="w-8 h-8 inline-flex items-center justify-center bg-[#15151B] hover:bg-[#23232D] border border-white/10 text-[#E4E4E7] shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Garment Selector Bar (01-17) */}
      <div className="px-5 py-3 border-b border-white/10 bg-[#0F0F14] flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevGarment}
          aria-label="Previous catalog tee"
          className="w-8 h-8 inline-flex items-center justify-center bg-[#17171F] hover:bg-[#23232E] border border-white/10 text-[#E4E4E7] shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <select
          aria-label="Select garment from 17-piece catalog"
          value={activeGarment.id}
          onChange={(e) => onSelectGarment(e.target.value)}
          className="flex-1 h-8 px-2.5 bg-[#17171F] border border-white/15 text-xs font-mono-tabular text-[#F5F5F4] focus:border-[#C81E2B] outline-none"
        >
          {GARMENT_CATALOG.map((item) => {
            const custom = hasCustomizations(
              overrides[item.id],
              item.baseColor === 'brown',
            );
            return (
              <option key={item.id} value={item.id} className="bg-[#111116] text-white">
                {item.indexLabel}. {item.name}
                {custom ? ' ★' : ''}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          onClick={onNextGarment}
          aria-label="Next catalog tee"
          className="w-8 h-8 inline-flex items-center justify-center bg-[#17171F] hover:bg-[#23232E] border border-white/10 text-[#E4E4E7] shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Editor Controls */}
      <div className="flex-1 overflow-y-auto pp-scroll px-5 py-4 space-y-5">
        {/* 1. Front / Back Print Side Switcher */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono-tabular uppercase text-[#A1A1AA]">
              1. Print Zone & Transparent PNG
            </span>
            <span className="text-[11px] font-mono-tabular text-[#71717A]">
              Flat Chest / Back UV
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-[#131319] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => handleSideSwitch('front')}
              className={`py-1.5 text-xs font-medium transition-colors ${
                editSide === 'front'
                  ? 'bg-[#C81E2B] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Front Print {current.frontPngDataUrl ? '· PNG' : ''}
            </button>
            <button
              type="button"
              onClick={() => handleSideSwitch('back')}
              className={`py-1.5 text-xs font-medium transition-colors ${
                editSide === 'back'
                  ? 'bg-[#C81E2B] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Back Print {current.backPngDataUrl ? '· PNG' : ''}
            </button>
          </div>

          {/* Drag & Drop PNG Upload Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            className={`mt-3 p-3.5 border border-dashed transition-colors ${
              isDraggingOver
                ? 'border-[#E11D2E] bg-[#241216]'
                : 'border-white/20 bg-[#121218]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />

            {activePngUrl ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 shrink-0 border border-white/15 flex items-center justify-center p-1"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #1b1b22 25%, transparent 25%), linear-gradient(-45deg, #1b1b22 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1b1b22 75%), linear-gradient(-45deg, transparent 75%, #1b1b22 75%)',
                    backgroundSize: '12px 12px',
                    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                    backgroundColor: '#111116',
                  }}
                >
                  <img
                    src={activePngUrl}
                    alt={`Uploaded ${editSide} print artwork`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#F5F5F4]">
                    Custom {editSide === 'front' ? 'Front' : 'Back'} PNG Active
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#A1A1AA]">
                    Blended into 280GSM cotton weave
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-medium bg-[#1E1E28] hover:bg-[#2A2A36] text-[#F5F5F4] border border-white/15"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOverride(activeGarment.id, (prev) => ({
                          ...prev,
                          ...(editSide === 'front'
                            ? { frontPngDataUrl: null }
                            : { backPngDataUrl: null }),
                        }))
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-[#A1A1AA] hover:text-[#E11D2E] border border-white/10"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 flex flex-col items-center justify-center text-center group"
              >
                <Upload
                  className="w-5 h-5 text-[#A1A1AA] group-hover:text-[#E11D2E] transition-colors"
                  aria-hidden="true"
                />
                <span className="mt-2 text-xs font-medium text-[#F5F5F4]">
                  Upload {editSide === 'front' ? 'Front' : 'Back'} Print PNG
                </span>
                <span className="mt-0.5 text-[11px] text-[#71717A]">
                  Transparent PNG recommended · Drag & drop or click
                </span>
              </button>
            )}

            {uploadError && (
              <p className="mt-2 text-xs text-[#F87171]">{uploadError}</p>
            )}
          </div>
        </div>

        {/* 2. Print Scale & Vertical Offset Sliders */}
        <div className="pt-4 border-t border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tabular uppercase text-[#A1A1AA]">
              2. {editSide === 'front' ? 'Front' : 'Back'} Placement
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateOverride(activeGarment.id, (prev) => ({
                  ...prev,
                  ...(editSide === 'front'
                    ? { frontScale: 1.0, frontOffsetY: 0.0 }
                    : { backScale: 1.0, backOffsetY: 0.0 }),
                }))
              }
              className="text-[11px] text-[#A1A1AA] hover:text-white underline underline-offset-4"
            >
              Center & Fit
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="pp-print-scale" className="text-[#D4D4D8]">
                Print Scale
              </label>
              <span className="font-mono-tabular text-[#F5F5F4]">
                {Math.round(activeScale * 100)}%
              </span>
            </div>
            <input
              id="pp-print-scale"
              type="range"
              min={0.4}
              max={1.45}
              step={0.01}
              value={activeScale}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateOverride(activeGarment.id, (prev) => ({
                  ...prev,
                  ...(editSide === 'front'
                    ? { frontScale: val }
                    : { backScale: val }),
                }));
              }}
              className="w-full accent-[#C81E2B] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="pp-print-offset" className="text-[#D4D4D8]">
                Vertical Offset
              </label>
              <span className="font-mono-tabular text-[#F5F5F4]">
                {activeOffsetY > 0 ? '+' : ''}
                {Math.round(activeOffsetY * 100)}%
              </span>
            </div>
            <input
              id="pp-print-offset"
              type="range"
              min={-0.25}
              max={0.25}
              step={0.01}
              value={activeOffsetY}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateOverride(activeGarment.id, (prev) => ({
                  ...prev,
                  ...(editSide === 'front'
                    ? { frontOffsetY: val }
                    : { backOffsetY: val }),
                }));
              }}
              className="w-full accent-[#C81E2B] cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] font-mono-tabular text-[#71717A]">
              <span>Higher (Collar)</span>
              <span>Center</span>
              <span>Lower (Hem)</span>
            </div>
          </div>
        </div>

        {/* 3. Base Fabric Color & Washed / Vintage Toggle */}
        <div className="pt-4 border-t border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tabular uppercase text-[#A1A1AA]">
              3. Base Fabric & Finish
            </span>
            {current.baseHex && (
              <button
                type="button"
                onClick={() =>
                  onUpdateOverride(activeGarment.id, (prev) => ({
                    ...prev,
                    baseHex: null,
                  }))
                }
                className="text-[11px] text-[#A1A1AA] hover:text-white underline underline-offset-4"
              >
                Use PDF Color
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {FABRIC_SWATCH_PRESETS.map((swatch) => {
              const selected =
                current.baseHex?.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() =>
                    onUpdateOverride(activeGarment.id, (prev) => ({
                      ...prev,
                      baseHex: swatch.hex,
                      ...(swatch.defaultWashed !== undefined
                        ? { washedEffect: swatch.defaultWashed }
                        : {}),
                    }))
                  }
                  className={`p-2 text-left border transition-colors flex items-center gap-2 ${
                    selected
                      ? 'border-[#C81E2B] bg-[#1F1316]'
                      : 'border-white/10 bg-[#131319] hover:border-white/25'
                  }`}
                >
                  <span
                    className="w-4 h-4 shrink-0 border border-white/25"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="text-[11px] text-[#E4E4E7] truncate">
                    {swatch.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Hex Color Input */}
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#131319] border border-white/10">
            <label
              htmlFor="pp-custom-fabric-color"
              className="text-xs text-[#D4D4D8]"
            >
              Custom Fabric Tone
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-[11px] text-[#A1A1AA] uppercase">
                {activeHexDisplay}
              </span>
              <input
                id="pp-custom-fabric-color"
                type="color"
                value={activeHexDisplay}
                onChange={(e) =>
                  onUpdateOverride(activeGarment.id, (prev) => ({
                    ...prev,
                    baseHex: e.target.value,
                  }))
                }
                className="w-7 h-7 bg-transparent border border-white/20 cursor-pointer"
              />
            </div>
          </div>

          {/* Washed / Vintage Pigment-Dye Toggle */}
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#131319] border border-white/10">
            <div>
              <div className="text-xs font-medium text-[#F5F5F4]">
                Washed / Vintage Effect
              </div>
              <div className="text-[11px] text-[#A1A1AA]">
                Mineral pigment fade & soft-hand worn ink
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={current.washedEffect}
              onClick={() =>
                onUpdateOverride(activeGarment.id, (prev) => ({
                  ...prev,
                  washedEffect: !prev.washedEffect,
                }))
              }
              className={`w-11 h-6 p-0.5 transition-colors border shrink-0 flex items-center ${
                current.washedEffect
                  ? 'bg-[#C81E2B] border-[#E11D2E] justify-end'
                  : 'bg-[#1D1D25] border-white/15 justify-start'
              }`}
            >
              <span className="w-4 h-4 bg-[#F5F5F4] block" />
            </button>
          </div>
        </div>
      </div>

      {/* Persistence & Reset Footer */}
      <div className="px-5 py-3.5 border-t border-white/10 bg-[#0E0E13] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-[#A1A1AA]">
          <Database className="w-3.5 h-3.5 text-[#D4D4D8] shrink-0" aria-hidden="true" />
          <span>IndexedDB · {totalCustomizedCount}/17 saved</span>
        </div>

        <button
          type="button"
          disabled={!isCustomized}
          onClick={() => onResetGarment(activeGarment.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border transition-colors whitespace-nowrap ${
            isCustomized
              ? 'bg-[#181820] hover:bg-[#242430] text-[#F5F5F4] border-white/15'
              : 'bg-[#121217] text-[#52525B] border-white/5 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          <span>Reset Tee</span>
        </button>
      </div>
    </aside>
  );
};
