import { create } from 'zustand';

/**
 * Booking wizard state — lưu qua các bước (services -> staff -> date/time -> info -> confirm).
 */
export const useBookingStore = create((set, get) => ({
  // Bước 1
  branchId: null,
  serviceIds: [],
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
  recurring: { enabled: false, frequency: 'WEEKLY', occurrenceCount: 4, staffMode: 'ANY_AVAILABLE', skipConflicts: true },
  recurringPreview: null,

  // Helpers
  setBranch: (branchId) => set({ branchId, serviceIds: [], comboId: null, combo: null, staffId: null, date: null, slot: null, voucherCode: '', pricePreview: null, recurringPreview: null }),
  toggleService: (id) =>
    set((s) => ({
      serviceIds: s.serviceIds.includes(id)
        ? s.serviceIds.filter((x) => x !== id)
        : [...s.serviceIds, id],
      comboId: null,
      combo: null,
    })),
  setCombo: (combo) => set({
    comboId: combo?.id ?? null,
    combo: combo ?? null,
    serviceIds: combo ? combo.comboServices.map((item) => item.serviceId) : [],
    staffId: null, date: null, slot: null, pricePreview: null, recurringPreview: null,
  }),
  setStaff: (staffId) => set({ staffId, date: null, slot: null }),
  setDate: (date) => set({ date, slot: null }),
  setSlot: (slot) => set({ slot }),
  setCustomerInfo: (info) => set({ customerInfo: { ...get().customerInfo, ...info } }),
  setVoucherCode: (code) => set({ voucherCode: code }),
  setPricePreview: (preview) => set({ pricePreview: preview }),
  setRecurring: (value) => set((state) => ({ recurring: { ...state.recurring, ...value }, recurringPreview: null })),
  setRecurringPreview: (preview) => set({ recurringPreview: preview }),

  reset: () =>
    set({
      branchId: null,
      serviceIds: [],
      comboId: null,
      combo: null,
      staffId: null,
      date: null,
      slot: null,
      customerInfo: { fullName: '', phone: '', email: '', password: '', note: '' },
      voucherCode: '',
      pricePreview: null,
      recurring: { enabled: false, frequency: 'WEEKLY', occurrenceCount: 4, staffMode: 'ANY_AVAILABLE', skipConflicts: true },
      recurringPreview: null,
    }),
}));
