import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, RotateCcw, Search, ShoppingBag, X } from 'lucide-react';
import {
  GARMENT_CATALOG,
  GarmentBaseColor,
  GarmentProduct,
  GarmentSize,
} from '../data/catalog';
import {
  GarmentThumbPair,
  loadGarmentThumbnails,
} from '../utils/pdfArtworkPipeline';
import { GarmentArtworkOverride } from '../utils/artworkStorage';

export interface CollectionDrawerProps {
  open: boolean;
  variant: 'collection' | 'lookbook';
  activeGarmentId: string;
  selectedSize: GarmentSize;
  thumbnails: Record<string, GarmentThumbPair>;
  artworkOverrides: Record<string, GarmentArtworkOverride>;
  onThumbReady: (garmentId: string, frontUrl: string, backUrl: string) => void;
  onClose: () => void;
  onInspectGarment: (garmentId: string) => void;
  onQuickAdd: (garment: GarmentProduct) => void;
  onSwitchVariant: (variant: 'collection' | 'lookbook') => void;
}

type ColorFilter = 'all' | GarmentBaseColor;

const COLOR_FILTERS: Array<{ id: ColorFilter; label: string }> = [
  { id: 'all', label: 'All 17' },
  { id: 'black', label: 'Obsidian Black' },
  { id: 'white', label: 'Optic White' },
  { id: 'brown', label: 'Washed Espresso' },
];

export const CollectionDrawer: React.FC<CollectionDrawerProps> = ({
  open,
  variant,
  activeGarmentId,
  selectedSize,
  thumbnails,
  artworkOverrides,
  onThumbReady,
  onClose,
  onInspectGarment,
  onQuickAdd,
  onSwitchVariant,
}) => {
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [query, setQuery] = useState('');
  const [flippedBack, setFlippedBack] = useState<Record<string, boolean>>({});

  // Ensure any unrendered PDF/custom thumbnails load progressively while drawer is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const ensureAllLoaded = async () => {
      for (const item of GARMENT_CATALOG) {
        if (cancelled) return;
        if (thumbnails[item.id]) continue;
        try {
          const pair = await loadGarmentThumbnails(
            item,
            artworkOverrides[item.id],
          );
          if (!cancelled) {
            onThumbReady(item.id, pair.frontThumbUrl, pair.backThumbUrl);
          }
        } catch {
          // Ignore individual failures and continue
        }
      }
    };
    void ensureAllLoaded();
    return () => {
      cancelled = true;
    };
  }, [open, thumbnails, artworkOverrides, onThumbReady]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GARMENT_CATALOG.filter((item) => {
      if (colorFilter !== 'all' && item.baseColor !== colorFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.colorLabel.toLowerCase().includes(q) ||
        item.indexLabel.includes(q)
      );
    });
  }, [colorFilter, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-label={
        variant === 'lookbook'
          ? 'PENANCE PIERCE Lookbook Archive'
          : 'PENANCE PIERCE Full 17-Piece Collection'
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl h-full bg-[#0A0A0D] border-l border-white/15 flex flex-col">
        {/* Drawer Header */}
        <div className="px-5 sm:px-8 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono-tabular text-[#A1A1AA]">
              PENANCE PIERCE · ARCHIVE COLLECTION · 17 HEAVYWEIGHT TEES
            </div>
            <h2 className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-wider text-[#F5F5F4]">
              {variant === 'lookbook' ? 'Editorial Lookbook' : 'Complete Collection'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Collection / Lookbook Switcher */}
            <div className="flex items-center bg-[#14141A] border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => onSwitchVariant('collection')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  variant === 'collection'
                    ? 'bg-[#262630] text-white'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                Grid Index
              </button>
              <button
                type="button"
                onClick={() => onSwitchVariant('lookbook')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  variant === 'lookbook'
                    ? 'bg-[#262630] text-white'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                Front & Back Plates
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close collection drawer"
              className="w-9 h-9 inline-flex items-center justify-center bg-[#15151B] hover:bg-[#22222C] border border-white/10 text-[#E4E4E7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-5 sm:px-8 py-3.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D0D11]">
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by colorway">
            {COLOR_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setColorFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                  colorFilter === f.id
                    ? 'bg-[#F5F5F4] text-[#070709] border-[#F5F5F4]'
                    : 'bg-[#14141A] text-[#A1A1AA] border-white/10 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search garment name or #..."
              className="w-full h-9 pl-9 pr-3 bg-[#14141A] border border-white/10 text-xs text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pp-scroll px-5 sm:px-8 py-6">
          {filtered.length === 0 ? (
            <div className="py-20 text-center border border-white/10 bg-[#111116]">
              <p className="font-display text-base text-[#F5F5F4]">
                No garments match your filter
              </p>
              <button
                type="button"
                onClick={() => {
                  setColorFilter('all');
                  setQuery('');
                }}
                className="mt-4 px-4 py-2 text-xs uppercase tracking-wider bg-[#1C1C24] hover:bg-[#272732] text-white border border-white/15"
              >
                Reset Filters
              </button>
            </div>
          ) : variant === 'collection' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item) => {
                const thumb = thumbnails[item.id];
                const showingBack = Boolean(flippedBack[item.id]);
                const active = item.id === activeGarmentId;
                const imgSrc = thumb
                  ? showingBack
                    ? thumb.backThumbUrl
                    : thumb.frontThumbUrl
                  : '';

                return (
                  <article
                    key={item.id}
                    className={`flex flex-col border transition-colors bg-[#111115] ${
                      active
                        ? 'border-[#C81E2B]'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    {/* Garment Flat-Lay Preview */}
                    <div
                      className="relative aspect-square w-full bg-[#15151A] overflow-hidden cursor-pointer group"
                      onClick={() => onInspectGarment(item.id)}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={`PENANCE PIERCE ${item.name} ${showingBack ? 'back' : 'front'} design`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#71717A] p-4">
                          <span className="font-mono-tabular text-xs">{item.indexLabel}</span>
                          <span className="mt-1 font-display text-sm text-[#A1A1AA]">
                            {item.name}
                          </span>
                        </div>
                      )}

                      {/* Inline Front/Back Flip Toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedBack((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }));
                        }}
                        className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono-tabular bg-[#0A0A0D]/90 hover:bg-[#1B1B22] text-[#E4E4E7] border border-white/15"
                      >
                        <RotateCcw className="w-3 h-3" aria-hidden="true" />
                        <span>{showingBack ? 'Back' : 'Front'}</span>
                      </button>
                    </div>

                    {/* Clean Unboxed Card Metadata */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-[#A1A1AA]">
                          <span>
                            {item.indexLabel} · {item.colorLabel}
                          </span>
                          {active && (
                            <span className="text-[#E11D2E] font-medium">On Stage</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between gap-2">
                          <h3 className="font-display text-base font-semibold text-[#F5F5F4] tracking-wide">
                            {item.name}
                          </h3>
                          <span className="font-mono-tabular text-sm text-[#E4E4E7] shrink-0">
                            ${item.priceUsd}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#A1A1AA] line-clamp-2">
                          {item.subtitle}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectGarment(item.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium bg-[#18181F] hover:bg-[#252530] text-[#F5F5F4] border border-white/15 transition-colors whitespace-nowrap"
                        >
                          <span>Inspect 3D</span>
                          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickAdd(item)}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold bg-[#C81E2B] hover:bg-[#DC2626] text-white transition-colors whitespace-nowrap"
                          title={`Add size ${selectedSize} to bag`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>+ {selectedSize}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* Lookbook Editorial Dual Front/Back Plate Stream */
            <div className="space-y-8">
              {filtered.map((item) => {
                const thumb = thumbnails[item.id];
                const active = item.id === activeGarmentId;
                return (
                  <article
                    key={item.id}
                    className={`border bg-[#111115] ${
                      active ? 'border-[#C81E2B]' : 'border-white/10'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 bg-[#15151A]">
                      <div className="relative aspect-square p-6 flex items-center justify-center">
                        <span className="absolute top-3 left-4 text-[11px] font-mono-tabular text-[#A1A1AA]">
                          FRONT VIEW
                        </span>
                        {thumb?.frontThumbUrl ? (
                          <img
                            src={thumb.frontThumbUrl}
                            alt={`${item.name} front artwork`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs font-mono-tabular text-[#71717A]">
                            Loading original plate…
                          </span>
                        )}
                      </div>
                      <div className="relative aspect-square p-6 flex items-center justify-center">
                        <span className="absolute top-3 left-4 text-[11px] font-mono-tabular text-[#A1A1AA]">
                          BACK VIEW
                        </span>
                        {thumb?.backThumbUrl ? (
                          <img
                            src={thumb.backThumbUrl}
                            alt={`${item.name} back artwork`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs font-mono-tabular text-[#71717A]">
                            Loading original plate…
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-white/10">
                      <div className="max-w-xl">
                        <div className="text-[11px] font-mono-tabular text-[#A1A1AA]">
                          Plate {item.indexLabel} / 17 · {item.colorLabel} · {item.finishLabel}
                        </div>
                        <h3 className="mt-1 font-display text-lg font-semibold text-[#F5F5F4] tracking-wider">
                          {item.name} — {item.subtitle}
                        </h3>
                        <p className="mt-1.5 text-sm text-[#A1A1AA] leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono-tabular text-base font-medium text-[#F5F5F4]">
                          ${item.priceUsd}
                        </span>
                        <button
                          type="button"
                          onClick={() => onInspectGarment(item.id)}
                          className="h-9 px-4 text-xs font-medium uppercase tracking-wider bg-[#1B1B22] hover:bg-[#272732] text-white border border-white/15 whitespace-nowrap"
                        >
                          Open in 3D Stage
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickAdd(item)}
                          className="h-9 px-4 text-xs font-semibold uppercase tracking-wider bg-[#C81E2B] hover:bg-[#DC2626] text-white whitespace-nowrap"
                        >
                          Add {selectedSize}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
