import { create } from 'zustand';

/**
 * Booking wizard state — lưu qua các bước (services -> staff -> date/time -> info -> confirm).
 */
export const useBookingStore = create((set, get) => ({
  // Bước 1
  branchId: null,
  serviceIds: [],
  variantSelections: {},
  comboId: null,
  combo: null,

  // Bước 2
  staffId: null,

  // Bước 3
  date: null,
  slot: null, // { start, end }

  // Bước 4
  customerInfo: {
    fullName: '',
    phone: '',
    email: '',
    password: '',
    note: '',
  },

  // Voucher (optional)
  voucherCode: '',
  pricePreview: null, // { subtotal, voucherDiscount, finalAmount }
  loyaltyPoints: 0,
  recurring: { enabled: false, frequency: 'WEEKLY', occurrenceCount: 4, staffMode: 'ANY_AVAILABLE', skipConflicts: true },
  recurringPreview: null,

  // Helpers
  setBranch: (branchId) => set({ branchId, serviceIds: [], variantSelections: {}, comboId: null, combo: null, staffId: null, date: null, slot: null, voucherCode: '', loyaltyPoints: 0, pricePreview: null, recurringPreview: null }),
  toggleService: (id) =>
    set((s) => ({
      serviceIds: s.serviceIds.includes(id)
        ? s.serviceIds.filter((x) => x !== id)
        : [...s.serviceIds, id],
      variantSelections: s.serviceIds.includes(id)
        ? Object.fromEntries(Object.entries(s.variantSelections).filter(([serviceId]) => serviceId !== id))
        : s.variantSelections,
      comboId: null,
      combo: null,
      staffId: null,
      date: null,
      slot: null,
      pricePreview: null,
      recurringPreview: null,
    })),
  setVariant: (serviceId, variantId) => set((state) => ({
    variantSelections: { ...state.variantSelections, [serviceId]: variantId },
    staffId: null,
    date: null,
    slot: null,
    pricePreview: null,
    recurringPreview: null,
  })),
  setCombo: (combo) => set({
    comboId: combo?.id ?? null,
    combo: combo ?? null,
    serviceIds: combo ? combo.comboServices.map((item) => item.serviceId) : [],
    variantSelections: {},
    staffId: null, date: null, slot: null, pricePreview: null, recurringPreview: null,
  }),
  setStaff: (staffId) => set({ staffId, date: null, slot: null, pricePreview: null, recurringPreview: null }),
  setDate: (date) => set({ date, slot: null, pricePreview: null, recurringPreview: null }),
  setSlot: (slot) => set({ slot, pricePreview: null, recurringPreview: null }),
  setCustomerInfo: (info) => set({ customerInfo: { ...get().customerInfo, ...info } }),
  setVoucherCode: (code) => set({ voucherCode: code }),
  setPricePreview: (preview) => set({ pricePreview: preview }),
  setLoyaltyPoints: (points) => set({ loyaltyPoints: Math.max(0, Number(points) || 0), pricePreview: null }),
  setRecurring: (value) => set((state) => ({ recurring: { ...state.recurring, ...value }, recurringPreview: null })),
  setRecurringPreview: (preview) => set({ recurringPreview: preview }),

  reset: () =>
    set({
      branchId: null,
      serviceIds: [],
      variantSelections: {},
      comboId: null,
      combo: null,
      staffId: null,
      date: null,
      slot: null,
      customerInfo: { fullName: '', phone: '', email: '', password: '', note: '' },
      voucherCode: '',
      pricePreview: null,
      loyaltyPoints: 0,
      recurring: { enabled: false, frequency: 'WEEKLY', occurrenceCount: 4, staffMode: 'ANY_AVAILABLE', skipConflicts: true },
      recurringPreview: null,
    }),
}));
