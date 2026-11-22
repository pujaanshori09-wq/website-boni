import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GarmentSize, SIZE_CHART_DATA } from '../data/catalog';

export interface SizeGuideModalProps {
  open: boolean;
  selectedSize: GarmentSize;
  onSelectSize: (size: GarmentSize) => void;
  onClose: () => void;
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({
  open,
  selectedSize,
  onSelectSize,
  onClose,
}) => {
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  if (!open) return null;

  const formatMeasure = (cm: number) =>
    unit === 'cm' ? `${cm.toFixed(1)}` : `${(cm / 2.54).toFixed(1)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="PENANCE PIERCE Sizing Guide"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-[#0D0D11] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono-tabular text-[#A1A1AA]">
              HEAVYWEIGHT BOXY SILHOUETTE · 280 GSM COMBED COTTON
            </div>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-wider text-[#F5F5F4]">
              Garment Measurements & Fit
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sizing guide"
            className="w-9 h-9 inline-flex items-center justify-center bg-[#16161C] hover:bg-[#23232D] border border-white/10 text-[#E4E4E7]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto pp-scroll">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-md leading-relaxed">
              Cut in our signature drop-shoulder boxy silhouette with a thick 1.2-inch ribbed crewneck. Take your true size for an architectural oversized drape, or size down once for a closer fit.
            </p>

            <div className="flex items-center bg-[#15151B] border border-white/10 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setUnit('cm')}
                className={`px-3 py-1 text-xs font-mono-tabular transition-colors ${
                  unit === 'cm' ? 'bg-[#F5F5F4] text-[#070709] font-semibold' : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                CM
              </button>
              <button
                type="button"
                onClick={() => setUnit('in')}
                className={`px-3 py-1 text-xs font-mono-tabular transition-colors ${
                  unit === 'in' ? 'bg-[#F5F5F4] text-[#070709] font-semibold' : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                IN
              </button>
            </div>
          </div>

          {/* Tabular Measurements Table */}
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#14141A] border-b border-white/10 text-[11px] font-mono-tabular uppercase text-[#A1A1AA]">
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Half Chest ({unit})</th>
                  <th className="py-3 px-4">Body Length ({unit})</th>
                  <th className="py-3 px-4">Shoulder ({unit})</th>
                  <th className="py-3 px-4">Sleeve ({unit})</th>
                  <th className="py-3 px-4 text-right">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs sm:text-sm font-mono-tabular">
                {SIZE_CHART_DATA.map((row) => {
                  const active = row.size === selectedSize;
                  return (
                    <tr
                      key={row.size}
                      className={
                        active ? 'bg-[#1D1215] text-white' : 'bg-[#0F0F13] text-[#D4D4D8]'
                      }
                    >
                      <td className="py-3 px-4 font-semibold text-[#F5F5F4]">{row.size}</td>
                      <td className="py-3 px-4">{formatMeasure(row.chestCm)}</td>
                      <td className="py-3 px-4">{formatMeasure(row.lengthCm)}</td>
                      <td className="py-3 px-4">{formatMeasure(row.shoulderCm)}</td>
                      <td className="py-3 px-4">{formatMeasure(row.sleeveCm)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSize(row.size);
                            onClose();
                          }}
                          className={`px-3 py-1 text-[11px] font-sans font-medium uppercase tracking-wider border transition-colors ${
                            active
                              ? 'bg-[#C81E2B] text-white border-[#C81E2B]'
                              : 'bg-[#18181F] text-[#D4D4D8] border-white/15 hover:text-white'
                          }`}
                        >
                          {active ? 'Active' : 'Use'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Garment Construction & Care */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs text-[#A1A1AA]">
            <div className="p-4 bg-[#121217] border border-white/10">
              <h3 className="text-[#F5F5F4] font-semibold tracking-wide">
                Fabric & Construction
              </h3>
              <p className="mt-1.5 leading-relaxed">
                100% ring-spun 280 GSM heavyweight cotton jersey, pre-shrunk and enzyme washed. Reinforced shoulder taping and double-needle stitched waist and sleeve hems.
              </p>
            </div>
            <div className="p-4 bg-[#121217] border border-white/10">
              <h3 className="text-[#F5F5F4] font-semibold tracking-wide">
                Artwork Care
              </h3>
              <p className="mt-1.5 leading-relaxed">
                Machine wash cold inside-out with mild detergent. Hang dry in shade. Never iron directly over high-gloss wax, liquid chrome, or plush flock prints.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
