import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  FREE_SHIPPING_THRESHOLD_USD,
  GARMENT_CATALOG,
  GarmentSize,
  STANDARD_SHIPPING_USD,
} from '../data/catalog';
import { GarmentThumbPair } from '../utils/pdfArtworkPipeline';

export interface CartItem {
  garmentId: string;
  size: GarmentSize;
  quantity: number;
}

export interface CartCheckoutDrawerProps {
  open: boolean;
  items: CartItem[];
  thumbnails: Record<string, GarmentThumbPair>;
  onClose: () => void;
  onUpdateQty: (garmentId: string, size: GarmentSize, delta: number) => void;
  onRemoveItem: (garmentId: string, size: GarmentSize) => void;
  onClearCart: () => void;
  onOpenCollection: () => void;
}

type CheckoutStep = 'bag' | 'checkout' | 'confirmed';

interface ShippingFormState {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  deliveryMethod: 'express' | 'priority';
  paymentMethod: 'card' | 'cod';
}

interface OrderReceipt {
  orderNumber: string;
  placedAt: string;
  customerName: string;
  email: string;
  addressSummary: string;
  paymentLabel: string;
  items: Array<{
    name: string;
    size: GarmentSize;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
}

const INITIAL_FORM: ShippingFormState = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'United States',
  deliveryMethod: 'express',
  paymentMethod: 'card',
};

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  open,
  items,
  thumbnails,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenCollection,
}) => {
  const [step, setStep] = useState<CheckoutStep>('bag');
  const [form, setForm] = useState<ShippingFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingFormState, string>>>({});
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const enrichedItems = useMemo(() => {
    return items
      .map((item) => {
        const product = GARMENT_CATALOG.find((g) => g.id === item.garmentId);
        if (!product) return null;
        return {
          ...item,
          product,
          lineTotal: product.priceUsd * item.quantity,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [items]);

  const subtotal = useMemo(
    () => enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [enrichedItems],
  );

  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD_USD - subtotal);
  const baseShipping =
    subtotal === 0
      ? 0
      : subtotal >= FREE_SHIPPING_THRESHOLD_USD
        ? 0
        : STANDARD_SHIPPING_USD;
  const shippingCost =
    form.deliveryMethod === 'priority' && subtotal > 0 ? baseShipping + 15 : baseShipping;
  const orderTotal = subtotal + shippingCost;

  if (!open) return null;

  const handleClose = () => {
    if (step === 'confirmed') {
      setStep('bag');
      setReceipt(null);
    }
    onClose();
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Partial<Record<keyof ShippingFormState, string>> = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Valid email address is required.';
    }
    if (!form.address.trim()) nextErrors.address = 'Street address is required.';
    if (!form.city.trim()) nextErrors.city = 'City is required.';
    if (!form.postalCode.trim()) nextErrors.postalCode = 'Postal code is required.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const orderNum = `PP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowLabel = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setReceipt({
      orderNumber: orderNum,
      placedAt: nowLabel,
      customerName: form.fullName.trim(),
      email: form.email.trim(),
      addressSummary: `${form.address.trim()}, ${form.city.trim()} ${form.postalCode.trim()}, ${form.country}`,
      paymentLabel:
        form.paymentMethod === 'card' ? 'Credit / Debit Card' : 'Cash on Delivery (COD)',
      items: enrichedItems.map((entry) => ({
        name: entry.product.name,
        size: entry.size,
        quantity: entry.quantity,
        lineTotal: entry.lineTotal,
      })),
      subtotal,
      shipping: shippingCost,
      total: orderTotal,
    });
    onClearCart();
    setStep('confirmed');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag and Checkout"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md h-full bg-[#0A0A0D] border-l border-white/15 flex flex-col">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('bag')}
                aria-label="Back to shopping bag"
                className="w-8 h-8 inline-flex items-center justify-center bg-[#15151B] hover:bg-[#22222C] border border-white/10 text-[#E4E4E7]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="text-[11px] font-mono-tabular text-[#A1A1AA]">
                PENANCE PIERCE STOREFRONT
              </div>
              <h2 className="font-display text-lg font-semibold tracking-wider text-[#F5F5F4]">
                {step === 'bag'
                  ? `Shopping Bag (${enrichedItems.reduce((s, i) => s + i.quantity, 0)})`
                  : step === 'checkout'
                    ? 'Express Checkout'
                    : 'Order Confirmed'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close bag drawer"
            className="w-9 h-9 inline-flex items-center justify-center bg-[#15151B] hover:bg-[#22222C] border border-white/10 text-[#E4E4E7]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: SHOPPING BAG */}
        {step === 'bag' && (
          <>
            {/* Free Shipping Progress Strip */}
            {enrichedItems.length > 0 && (
              <div className="px-6 py-3 bg-[#111116] border-b border-white/10">
                <div className="flex items-center justify-between text-xs text-[#D4D4D8]">
                  <span>
                    {freeShippingRemaining === 0
                      ? 'Complimentary Express Shipping unlocked'
                      : `Add $${freeShippingRemaining} more for complimentary Express Shipping`}
                  </span>
                  <span className="font-mono-tabular text-[#A1A1AA]">
                    ${Math.min(subtotal, FREE_SHIPPING_THRESHOLD_USD)} / ${FREE_SHIPPING_THRESHOLD_USD}
                  </span>
                </div>
                <div className="mt-2 h-1 bg-[#22222B] overflow-hidden">
                  <div
                    className="h-full bg-[#C81E2B] transition-all duration-200"
                    style={{
                      width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD_USD) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pp-scroll px-6 py-5">
              {enrichedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <ShoppingBag className="w-8 h-8 text-[#52525B]" aria-hidden="true" />
                  <h3 className="mt-4 font-display text-base text-[#F5F5F4] tracking-wider">
                    Your Bag Is Empty
                  </h3>
                  <p className="mt-2 text-xs text-[#A1A1AA] max-w-xs leading-relaxed">
                    Inspect any of the 17 archival PENANCE PIERCE tees in 3D and select your size to add it to your bag.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCollection();
                    }}
                    className="mt-6 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#C81E2B] hover:bg-[#DC2626] text-white"
                  >
                    Browse All 17 Tees
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {enrichedItems.map((entry) => {
                    const thumb = thumbnails[entry.garmentId]?.frontThumbUrl;
                    return (
                      <li
                        key={`${entry.garmentId}-${entry.size}`}
                        className="py-4 flex items-start gap-4"
                      >
                        <div className="w-20 h-20 bg-[#15151B] border border-white/10 shrink-0 flex items-center justify-center p-1.5">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={entry.product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="font-mono-tabular text-xs text-[#71717A]">
                              {entry.product.indexLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-display text-sm font-semibold text-[#F5F5F4] tracking-wide">
                                {entry.product.name}
                              </h4>
                              <div className="mt-0.5 text-[11px] font-mono-tabular text-[#A1A1AA]">
                                Size {entry.size} · {entry.product.colorLabel}
                              </div>
                            </div>
                            <span className="font-mono-tabular text-sm text-[#F5F5F4] shrink-0">
                              ${entry.lineTotal}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="inline-flex items-center border border-white/15 bg-[#14141A]">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(entry.garmentId, entry.size, -1)}
                                aria-label="Decrease quantity"
                                className="w-7 h-7 inline-flex items-center justify-center text-[#D4D4D8] hover:text-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-mono-tabular text-[#F5F5F4]">
                                {entry.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQty(entry.garmentId, entry.size, 1)}
                                aria-label="Increase quantity"
                                className="w-7 h-7 inline-flex items-center justify-center text-[#D4D4D8] hover:text-white"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveItem(entry.garmentId, entry.size)}
                              aria-label={`Remove ${entry.product.name}`}
                              className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA] hover:text-[#E11D2E] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {enrichedItems.length > 0 && (
              <div className="px-6 py-5 border-t border-white/10 bg-[#0D0D11] space-y-3">
                <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                  <span>Subtotal</span>
                  <span className="font-mono-tabular text-[#F5F5F4]">${subtotal} USD</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                  <span>Express Shipping</span>
                  <span className="font-mono-tabular text-[#D4D4D8]">
                    {baseShipping === 0 ? 'Complimentary' : `$${baseShipping} USD`}
                  </span>
                </div>
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-sm font-semibold text-[#F5F5F4]">
                  <span>Estimated Total</span>
                  <span className="font-mono-tabular">${subtotal + baseShipping} USD</span>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="w-full h-11 mt-2 bg-[#C81E2B] hover:bg-[#DC2626] text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </>
        )}

        {/* STEP 2: CHECKOUT FORM */}
        {step === 'checkout' && (
          <form onSubmit={validateAndSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto pp-scroll px-6 py-5 space-y-5">
              <div>
                <h3 className="text-xs font-mono-tabular uppercase text-[#A1A1AA] mb-3">
                  1. Contact & Shipping Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#D4D4D8] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Alex Mercer"
                      className="w-full h-10 px-3 bg-[#14141A] border border-white/15 text-sm text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-xs text-[#F87171]">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#D4D4D8] mb-1">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="collector@domain.com"
                        className="w-full h-10 px-3 bg-[#14141A] border border-white/15 text-sm text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-[#F87171]">{errors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-[#D4D4D8] mb-1">Phone (Optional)</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+1 (555) 014-8920"
                        className="w-full h-10 px-3 bg-[#14141A] border border-white/15 text-sm text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#D4D4D8] mb-1">Street Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="412 Mercer St, Apt 4B"
                      className="w-full h-10 px-3 bg-[#14141A] border border-white/15 text-sm text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
                    />
                    {errors.address && (
                      <p className="mt-1 text-xs text-[#F87171]">{errors.address}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#D4D4D8] mb-1">City</label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="New York"
                        className="w-full h-10 px-3 bg-[#14141A] border border-white/15 text-sm text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
                      />
                      {errors.city && (
                        <p className="mt-1 text-xs text-[#F87171]">{errors.city}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-[#D4D4D8] mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                        placeholder="10013"
                        className="w-full h-10 px-3 bg-[#14141A] border border-white/15 text-sm text-[#F5F5F4] placeholder:text-[#71717A] focus:border-[#C81E2B] outline-none"
                      />
                      {errors.postalCode && (
                        <p className="mt-1 text-xs text-[#F87171]">{errors.postalCode}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono-tabular uppercase text-[#A1A1AA] mb-2.5">
                  2. Shipping & Payment
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: 'express' })}
                    className={`p-3 text-left border transition-colors ${
                      form.deliveryMethod === 'express'
                        ? 'bg-[#1D1215] border-[#C81E2B] text-white'
                        : 'bg-[#14141A] border-white/10 text-[#A1A1AA]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#F5F5F4]">Express</div>
                    <div className="mt-0.5 text-[11px] font-mono-tabular">
                      {baseShipping === 0 ? 'Free' : `$${baseShipping}`} · 3–5 days
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: 'priority' })}
                    className={`p-3 text-left border transition-colors ${
                      form.deliveryMethod === 'priority'
                        ? 'bg-[#1D1215] border-[#C81E2B] text-white'
                        : 'bg-[#14141A] border-white/10 text-[#A1A1AA]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#F5F5F4]">Priority Air</div>
                    <div className="mt-0.5 text-[11px] font-mono-tabular">
                      +${15} · 1–2 days
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'card' })}
                    className={`p-3 text-left border transition-colors ${
                      form.paymentMethod === 'card'
                        ? 'bg-[#1D1215] border-[#C81E2B] text-white'
                        : 'bg-[#14141A] border-white/10 text-[#A1A1AA]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#F5F5F4]">Card Payment</div>
                    <div className="mt-0.5 text-[11px]">Demo checkout</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'cod' })}
                    className={`p-3 text-left border transition-colors ${
                      form.paymentMethod === 'cod'
                        ? 'bg-[#1D1215] border-[#C81E2B] text-white'
                        : 'bg-[#14141A] border-white/10 text-[#A1A1AA]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#F5F5F4]">Cash on Delivery</div>
                    <div className="mt-0.5 text-[11px]">Pay at doorstep</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-white/10 bg-[#0D0D11] space-y-2.5">
              <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                <span>Items ({enrichedItems.reduce((s, i) => s + i.quantity, 0)})</span>
                <span className="font-mono-tabular text-[#D4D4D8]">${subtotal} USD</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                <span>Shipping</span>
                <span className="font-mono-tabular text-[#D4D4D8]">
                  {shippingCost === 0 ? 'Complimentary' : `$${shippingCost} USD`}
                </span>
              </div>
              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-sm font-semibold text-[#F5F5F4]">
                <span>Total Due</span>
                <span className="font-mono-tabular">${orderTotal} USD</span>
              </div>

              <button
                type="submit"
                className="w-full h-11 mt-2 bg-[#C81E2B] hover:bg-[#DC2626] text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors inline-flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Complete Order · ${orderTotal}</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: ORDER CONFIRMATION RECEIPT */}
        {step === 'confirmed' && receipt && (
          <div className="flex-1 overflow-y-auto pp-scroll px-6 py-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="p-5 bg-[#121217] border border-[#C81E2B]/60">
                <div className="inline-flex items-center justify-center w-9 h-9 bg-[#C81E2B] text-white">
                  <Check className="w-5 h-5" />
                </div>
                <div className="mt-3 text-[11px] font-mono-tabular text-[#E11D2E]">
                  ORDER {receipt.orderNumber} · CONFIRMED
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold text-[#F5F5F4] tracking-wider">
                  Preparing Your Shipment
                </h3>
                <p className="mt-1.5 text-xs text-[#A1A1AA] leading-relaxed">
                  Thank you, {receipt.customerName}. Your PENANCE PIERCE archival order receipt has been logged for {receipt.email}.
                </p>
              </div>

              <div className="p-4 bg-[#111115] border border-white/10 space-y-3 text-xs">
                <div className="flex justify-between text-[#A1A1AA]">
                  <span>Timestamp</span>
                  <span className="font-mono-tabular text-[#D4D4D8]">{receipt.placedAt}</span>
                </div>
                <div className="flex justify-between text-[#A1A1AA]">
                  <span>Payment</span>
                  <span className="text-[#D4D4D8]">{receipt.paymentLabel}</span>
                </div>
                <div className="pt-2 border-t border-white/10 text-[#A1A1AA]">
                  <span className="block mb-1">Ship To</span>
                  <span className="text-[#F5F5F4]">{receipt.addressSummary}</span>
                </div>
              </div>

              <div className="p-4 bg-[#111115] border border-white/10 space-y-2 text-xs">
                <div className="text-[11px] font-mono-tabular text-[#A1A1AA] uppercase mb-2">
                  Archive Items
                </div>
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[#D4D4D8]">
                    <span>
                      {item.name} ({item.size}) × {item.quantity}
                    </span>
                    <span className="font-mono-tabular">${item.lineTotal}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-white/10 flex justify-between font-semibold text-[#F5F5F4]">
                  <span>Total Paid</span>
                  <span className="font-mono-tabular">${receipt.total} USD</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full h-11 mt-6 bg-[#18181F] hover:bg-[#252530] text-[#F5F5F4] border border-white/15 text-xs font-semibold uppercase tracking-[0.16em]"
            >
              Return to 3D Showroom
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
