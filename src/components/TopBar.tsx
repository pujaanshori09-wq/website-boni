import React from 'react';
import { ShoppingBag } from 'lucide-react';

export interface TopBarProps {
  activeView: 'showroom' | 'collection' | 'lookbook' | 'sizing';
  cartCount: number;
  onSelectShowroom: () => void;
  onOpenCollection: () => void;
  onOpenLookbook: () => void;
  onOpenSizing: () => void;
  onOpenCart: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  cartCount,
  onSelectShowroom,
  onOpenCollection,
  onOpenLookbook,
  onOpenSizing,
  onOpenCart,
}) => {
  const navLinkClass = (active: boolean) =>
    `text-xs sm:text-sm font-medium tracking-wide transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b ${
      active
        ? 'text-[#F5F5F4] border-[#C81E2B]'
        : 'text-[#A1A1AA] border-transparent hover:text-[#F5F5F4] hover:border-white/25'
    }`;

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-14 sm:h-16 bg-[#070709]/92 border-b border-white/10">
      <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={onSelectShowroom}
          className="font-display text-sm sm:text-lg font-semibold tracking-[0.22em] text-[#F5F5F4] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          PENANCE PIERCE
        </button>

        {/* Zone 2: 4 Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          <button
            type="button"
            onClick={onSelectShowroom}
            className={navLinkClass(activeView === 'showroom')}
          >
            Showroom
          </button>
          <button
            type="button"
            onClick={onOpenCollection}
            className={navLinkClass(activeView === 'collection')}
          >
            Collection
          </button>
          <button
            type="button"
            onClick={onOpenLookbook}
            className={navLinkClass(activeView === 'lookbook')}
          >
            Lookbook
          </button>
          <button
            type="button"
            onClick={onOpenSizing}
            className={navLinkClass(activeView === 'sizing')}
          >
            Size Guide
          </button>
        </nav>

        {/* Zone 3: Single Primary Action (Shopping Bag) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium tracking-wider uppercase bg-[#141419] hover:bg-[#1E1E26] text-[#F5F5F4] border border-white/15 transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4D4D8]" aria-hidden="true" />
            <span>Bag</span>
            <span className="font-mono-tabular text-[#E11D2E] font-semibold">
              ({cartCount})
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
