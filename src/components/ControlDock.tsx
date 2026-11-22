import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Grid,
  Info,
  Orbit,
  RotateCw,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  ZoomIn,
} from 'lucide-react';
import {
  GARMENT_SIZES,
  GarmentProduct,
  GarmentSize,
} from '../data/catalog';
import { CameraPreset, ShowroomMode } from './ShowroomCanvas';
import { LightingPreset } from '../three/showroomStage';

export interface ControlDockProps {
  garment: GarmentProduct;
  totalCount: number;
  selectedSize: GarmentSize;
  mode: ShowroomMode;
  autoSpin: boolean;
  lightingPreset: LightingPreset;
  showSuspension: boolean;
  isLoadingArtwork: boolean;
  collapsed: boolean;
  artworkManagerOpen: boolean;
  hasCustomArtwork: boolean;
  onToggleCollapsed: () => void;
  onToggleArtworkManager: () => void;
  onPrevGarment: () => void;
  onNextGarment: () => void;
  onSelectSize: (size: GarmentSize) => void;
  onAddToBag: () => void;
  onCameraPreset: (preset: CameraPreset) => void;
  onToggleMode: () => void;
  onToggleAutoSpin: () => void;
  onSelectLighting: (preset: LightingPreset) => void;
  onToggleSuspension: () => void;
  onOpenCollection: () => void;
  onOpenSizing: () => void;
}

const LIGHTING_OPTIONS: Array<{ id: LightingPreset; label: string }> = [
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'studio', label: 'Studio' },
  { id: 'crimson', label: 'Crimson' },
];

export const ControlDock: React.FC<ControlDockProps> = ({
  garment,
  totalCount,
  selectedSize,
  mode,
  autoSpin,
  lightingPreset,
  showSuspension,
  isLoadingArtwork,
  collapsed,
  artworkManagerOpen,
  hasCustomArtwork,
  onToggleCollapsed,
  onToggleArtworkManager,
  onPrevGarment,
  onNextGarment,
  onSelectSize,
  onAddToBag,
  onCameraPreset,
  onToggleMode,
  onToggleAutoSpin,
  onSelectLighting,
  onToggleSuspension,
  onOpenCollection,
  onOpenSizing,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className="fixed bottom-4 left-1/2 z-20 w-[min(940px,95vw)] transition-transform duration-200 ease-out"
      style={{
        transform: collapsed
          ? 'translate(-50%, calc(100% - 28px))'
          : 'translate(-50%, 0)',
      }}
    >
      {/* Top Collapse Toggle Tab + Subtle Mode Hint */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-tabular text-[#A1A1AA] bg-[#0B0B0F]/92 px-2.5 py-1 border border-white/10">
          <span>
            {mode === 'ring'
              ? 'Click any 3D frame to bring onto stage'
              : 'Drag to orbit 360° · Scroll to inspect fabric weave'}
          </span>
          {isLoadingArtwork && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#E4E4E7]">Rendering artwork…</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium tracking-wider uppercase text-[#D4D4D8] hover:text-white bg-[#111116]/95 border border-white/15 transition-colors whitespace-nowrap shrink-0"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Optional Compact Garment Details Popover (only when user clicks Info) */}
      {showDetails && !collapsed && (
        <div className="mb-2 p-4 bg-[#0E0E13]/96 border border-white/15 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono-tabular text-[#A1A1AA]">
                {garment.indexLabel} / {String(totalCount).padStart(2, '0')} ·{' '}
                {garment.colorLabel} · {garment.editionRun}
              </div>
              <h3 className="mt-1 font-display text-base font-semibold text-[#F5F5F4] tracking-wider">
                {garment.name} — {garment.subtitle}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-[#A1A1AA] leading-relaxed max-w-2xl">
                {garment.description}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#D4D4D8]">
                <span>280 GSM Heavyweight Combed Cotton</span>
                <span aria-hidden="true" className="text-white/25">
                  /
                </span>
                <span>{garment.finishLabel}</span>
                <span aria-hidden="true" className="text-white/25">
                  /
                </span>
                <span>{garment.hasBackGraphic ? 'Front & Back Print' : 'Front Print Only'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="text-xs text-[#A1A1AA] hover:text-white px-2 py-1 border border-white/10 shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Solid-Surface Unified Dock (No backdrop-filter over WebGL) */}
      <div className="bg-[#0E0E13]/96 border border-white/15 shadow-[0_18px_50px_rgba(0,0,0,0.85)]">
        {/* Top Tier: Garment Identity, Prev/Next, Size Selector & Add to Bag */}
        <div className="px-3.5 sm:px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10">
          {/* Active Garment Navigation */}
          <div className="flex items-center justify-between md:justify-start gap-3 min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onPrevGarment}
                aria-label="Previous garment"
                className="w-8 h-8 inline-flex items-center justify-center bg-[#18181F] hover:bg-[#23232D] border border-white/10 text-[#E4E4E7] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNextGarment}
                aria-label="Next garment"
                className="w-8 h-8 inline-flex items-center justify-center bg-[#18181F] hover:bg-[#23232D] border border-white/10 text-[#E4E4E7] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-[#A1A1AA]">
                <span className="text-[#E11D2E] font-medium">
                  {garment.indexLabel}/{String(totalCount).padStart(2, '0')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{garment.colorLabel}</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline text-[#D4D4D8]">
                  {garment.hasBackGraphic ? 'Front + Back' : 'Front'}
                </span>
              </div>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <h1 className="font-display text-sm sm:text-base font-semibold tracking-wider text-[#F5F5F4] truncate">
                  {garment.name}
                </h1>
                <span className="font-mono-tabular text-xs sm:text-sm text-[#E4E4E7] shrink-0">
                  ${garment.priceUsd}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-label="Toggle garment specifications"
              className={`ml-1 p-1.5 border transition-colors shrink-0 ${
                showDetails
                  ? 'border-[#C81E2B] text-white bg-[#C81E2B]/20'
                  : 'border-white/10 text-[#A1A1AA] hover:text-white bg-[#16161C]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Size Selector + Primary Add-to-Bag CTA */}
          <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0">
            <div className="flex items-center gap-1" role="group" aria-label="Select size">
              {GARMENT_SIZES.map((size) => {
                const active = selectedSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onSelectSize(size)}
                    className={`w-8 h-8 text-[11px] font-mono-tabular font-medium transition-colors border ${
                      active
                        ? 'bg-[#F5F5F4] text-[#070709] border-[#F5F5F4]'
                        : 'bg-[#16161C] text-[#A1A1AA] border-white/10 hover:text-white hover:border-white/25'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onAddToBag}
              className="inline-flex items-center gap-2 px-4 h-8 sm:h-9 bg-[#C81E2B] hover:bg-[#DC2626] text-white text-xs font-semibold tracking-wider uppercase transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add to Bag</span>
            </button>
          </div>
        </div>

        {/* Bottom Tier: 3D Camera Angles, Showroom Ring Mode, Lighting & Mobile Nav */}
        <div className="px-3.5 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Camera Inspection Controls */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onCameraPreset('front')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#16161C] hover:bg-[#22222B] text-[#E4E4E7] border border-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-[#A1A1AA]" aria-hidden="true" />
              <span>Front</span>
            </button>
            <button
              type="button"
              onClick={() => onCameraPreset('back')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#16161C] hover:bg-[#22222B] text-[#E4E4E7] border border-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-[#A1A1AA]" aria-hidden="true" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => onCameraPreset('macro')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#16161C] hover:bg-[#22222B] text-[#E4E4E7] border border-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <ZoomIn className="w-3.5 h-3.5 text-[#A1A1AA]" aria-hidden="true" />
              <span>Macro</span>
            </button>
            <button
              type="button"
              onClick={onToggleAutoSpin}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border transition-colors whitespace-nowrap shrink-0 ${
                autoSpin
                  ? 'bg-[#261418] text-white border-[#C81E2B]'
                  : 'bg-[#16161C] hover:bg-[#22222B] text-[#E4E4E7] border-white/10'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>360° Spin</span>
            </button>
            <button
              type="button"
              onClick={onToggleMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border transition-colors whitespace-nowrap shrink-0 ${
                mode === 'ring'
                  ? 'bg-[#261418] text-white border-[#C81E2B]'
                  : 'bg-[#16161C] hover:bg-[#22222B] text-[#E4E4E7] border-white/10'
              }`}
            >
              <Orbit className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{mode === 'ring' ? 'Inspection Stage' : '3D Ring (17)'}</span>
            </button>
          </div>

          {/* Lighting Presets & Collection Trigger */}
          <div className="flex items-center gap-2 ml-auto">
            <div
              className="hidden sm:flex items-center bg-[#14141A] border border-white/10 p-0.5"
              role="group"
              aria-label="Studio lighting preset"
            >
              <Sun className="w-3.5 h-3.5 text-[#A1A1AA] mx-1.5" aria-hidden="true" />
              {LIGHTING_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectLighting(opt.id)}
                  className={`px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    lightingPreset === opt.id
                      ? 'bg-[#272730] text-white'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleSuspension}
              title="Toggle chrome suspension rail"
              className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                showSuspension
                  ? 'bg-[#1C1C24] text-[#E4E4E7] border-white/20'
                  : 'bg-[#14141A] text-[#71717A] border-white/10 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              <span>Rail</span>
            </button>

            <button
              type="button"
              onClick={onOpenSizing}
              className="md:hidden inline-flex items-center px-2.5 py-1.5 bg-[#16161C] hover:bg-[#22222B] text-[#D4D4D8] border border-white/10 whitespace-nowrap shrink-0"
            >
              Sizing
            </button>

            <button
              type="button"
              onClick={onToggleArtworkManager}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border transition-colors whitespace-nowrap shrink-0 ${
                artworkManagerOpen
                  ? 'bg-[#261418] text-white border-[#C81E2B]'
                  : 'bg-[#181820] hover:bg-[#252530] text-[#F5F5F4] border-white/15'
              }`}
            >
              <SlidersHorizontal
                className="w-3.5 h-3.5 text-[#E11D2E]"
                aria-hidden="true"
              />
              <span>
                Manage Artwork{hasCustomArtwork ? ' · Custom' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenCollection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B1B22] hover:bg-[#272732] text-[#F5F5F4] border border-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              <Grid className="w-3.5 h-3.5 text-[#E11D2E]" aria-hidden="true" />
              <span>All 17 Tees</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
