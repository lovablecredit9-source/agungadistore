import { useState, useEffect } from "react";

export type Lang = "id" | "en";

const LANG_KEY = "app-language";

export function getSavedLang(): Lang {
  return (localStorage.getItem(LANG_KEY) as Lang) || "id";
}

export function saveLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang);
}

// Hook
let listeners: Array<(lang: Lang) => void> = [];
let currentLang: Lang = getSavedLang();

export function setGlobalLang(lang: Lang) {
  currentLang = lang;
  saveLang(lang);
  listeners.forEach(fn => fn(lang));
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(currentLang);
  useEffect(() => {
    const handler = (l: Lang) => setLang(l);
    listeners.push(handler);
    return () => { listeners = listeners.filter(fn => fn !== handler); };
  }, []);
  return [lang, setGlobalLang];
}

const translations = {
  // Header
  "header.tagline": { id: "Terpercaya • Aman • Murah", en: "Trusted • Safe • Affordable" },

  // Bottom nav
  "nav.home": { id: "Beranda", en: "Home" },
  "nav.products": { id: "Produk", en: "Products" },
  "nav.voucher": { id: "Voucher", en: "Voucher" },
  "nav.balance": { id: "Saldo", en: "Balance" },
  "nav.likes": { id: "Suka", en: "Likes" },
  "nav.history": { id: "Riwayat", en: "History" },
  "nav.ticket": { id: "Tiket", en: "Ticket" },

  // Home page
  "home.buy_premium": { id: "Beli akun digital premium dengan harga terbaik.", en: "Buy premium digital accounts at the best prices." },
  "home.contact_wa": { id: "Hubungi WA", en: "Contact WA" },
  "home.claim_voucher": { id: "Klaim Voucher", en: "Claim Voucher" },
  "home.products_available": { id: "Produk Tersedia", en: "Products Available" },
  "home.vouchers_claimed": { id: "Voucher Diklaim", en: "Vouchers Claimed" },
  "home.have_voucher": { id: "Punya Kode Voucher?", en: "Have a Voucher Code?" },
  "home.claim_now": { id: "Klaim akun premium kamu sekarang →", en: "Claim your premium account now →" },
  "home.have_issue": { id: "Ada Masalah?", en: "Got an Issue?" },
  "home.submit_ticket": { id: "Ajukan tiket keluhan →", en: "Submit a complaint ticket →" },
  "home.follow_us": { id: "Ikuti Kami", en: "Follow Us" },

  // Products
  "products.title": { id: "Daftar Produk", en: "Product List" },
  "products.search": { id: "Cari produk...", en: "Search products..." },
  "products.items": { id: "item", en: "items" },
  "products.newest": { id: "Terbaru", en: "Newest" },
  "products.oldest": { id: "Terlama", en: "Oldest" },
  "products.no_products": { id: "Belum ada produk.", en: "No products yet." },
  "products.stock": { id: "Stok", en: "Stock" },
  "products.warranty": { id: "Bergaransi", en: "Warranty" },
  "products.buy_wa": { id: "Beli via WA", en: "Buy via WA" },
  "products.buy_balance": { id: "Beli via Saldo", en: "Buy with Balance" },
  "products.chat_product": { id: "Chat Produk", en: "Chat Product" },
  "products.all": { id: "Semua", en: "All" },
  "products.other": { id: "Lainnya", en: "Others" },

  // Voucher
  "voucher.title": { id: "Klaim Voucher", en: "Claim Voucher" },
  "voucher.enter_code": { id: "Masukkan kode voucher", en: "Enter voucher code" },
  "voucher.claim": { id: "Klaim Sekarang", en: "Claim Now" },
  "voucher.claiming": { id: "Mengklaim...", en: "Claiming..." },
  "voucher.total_value": { id: "Total Nilai", en: "Total Value" },
  "voucher.download_pdf": { id: "Download PDF", en: "Download PDF" },

  // History
  "history.title": { id: "Riwayat Klaim", en: "Claim History" },
  "history.no_history": { id: "Belum ada riwayat klaim.", en: "No claim history yet." },
  "history.delete_selected": { id: "Hapus Terpilih", en: "Delete Selected" },
  "history.select_all": { id: "Pilih Semua", en: "Select All" },

  // Likes
  "likes.title": { id: "Produk Disukai", en: "Liked Products" },
  "likes.no_likes": { id: "Belum ada produk yang disukai.", en: "No liked products yet." },

  // Balance / Saldo
  "balance.title": { id: "Saldo Saya", en: "My Balance" },
  "balance.setup": { id: "Daftar Akun Saldo", en: "Register Balance Account" },
  "balance.username": { id: "Username", en: "Username" },
  "balance.phone": { id: "No. HP / WhatsApp", en: "Phone / WhatsApp" },
  "balance.register": { id: "Daftar Sekarang", en: "Register Now" },
  "balance.your_balance": { id: "Saldo Anda", en: "Your Balance" },
  "balance.transaction_history": { id: "Riwayat Transaksi", en: "Transaction History" },
  "balance.no_transactions": { id: "Belum ada transaksi.", en: "No transactions yet." },
  "balance.topup": { id: "Top Up", en: "Top Up" },
  "balance.purchase": { id: "Pembelian", en: "Purchase" },

  // Tickets
  "ticket.title": { id: "Tiket Keluhan", en: "Support Tickets" },
  "ticket.create": { id: "Buat Tiket Baru", en: "Create New Ticket" },
  "ticket.name": { id: "Nama lengkap", en: "Full name" },
  "ticket.phone": { id: "No. HP / WhatsApp", en: "Phone / WhatsApp" },
  "ticket.description": { id: "Jelaskan masalah kamu", en: "Describe your issue" },
  "ticket.submit": { id: "Kirim Tiket", en: "Submit Ticket" },
  "ticket.no_tickets": { id: "Belum ada tiket.", en: "No tickets yet." },
  "ticket.open": { id: "Buka", en: "Open" },
  "ticket.closed": { id: "Ditutup", en: "Closed" },
  "ticket.resolved": { id: "Selesai", en: "Resolved" },

  // Chat
  "chat.write_message": { id: "Tulis pesan...", en: "Write a message..." },
  "chat.history": { id: "Riwayat Chat", en: "Chat History" },
  "chat.no_history": { id: "Belum ada riwayat chat.", en: "No chat history yet." },
  "chat.reply_time": { id: "Biasa membalas dalam 5-10 menit", en: "Usually replies in 5-10 minutes" },
  "chat.active": { id: "Aktif", en: "Active" },
  "chat.closed": { id: "Ditutup", en: "Closed" },
  "chat.ticket_closed": { id: "Tiket ini sudah ditutup.", en: "This ticket is closed." },

  // Notifications
  "notif.title": { id: "Notifikasi", en: "Notifications" },
  "notif.mark_all_read": { id: "Tandai semua dibaca", en: "Mark all read" },
  "notif.no_notif": { id: "Belum ada notifikasi", en: "No notifications yet" },

  // Help center
  "help.title": { id: "Pusat Bantuan", en: "Help Center" },
  "help.version": { id: "Web v2.0 — April 2026", en: "Web v2.0 — April 2026" },

  // Buy confirm
  "buy.confirm_title": { id: "Konfirmasi Pembelian", en: "Confirm Purchase" },
  "buy.confirm_msg": { id: "Apakah kamu yakin ingin membeli produk ini menggunakan saldo?", en: "Are you sure you want to buy this product using your balance?" },
  "buy.cancel": { id: "Batal", en: "Cancel" },
  "buy.confirm": { id: "Ya, Beli Sekarang", en: "Yes, Buy Now" },
  "buy.success_title": { id: "Pembelian Berhasil! 🎉", en: "Purchase Successful! 🎉" },
  "buy.remaining_balance": { id: "Sisa saldo", en: "Remaining balance" },
  "buy.copy_voucher": { id: "Salin Voucher", en: "Copy Voucher" },

  // WhatsApp form
  "wa.title": { id: "Form Pembelian via WA", en: "WA Purchase Form" },
  "wa.name": { id: "Nama lengkap", en: "Full name" },
  "wa.phone": { id: "No. HP / WhatsApp", en: "Phone / WhatsApp" },
  "wa.note": { id: "Keterangan (opsional)", en: "Notes (optional)" },
  "wa.send": { id: "Kirim via WhatsApp", en: "Send via WhatsApp" },

  // Version footer
  "version.footer": { id: "Web Version 2.0 • April 2026", en: "Web Version 2.0 • April 2026" },

  // Deposit
  "deposit.title": { id: "Deposit Saldo", en: "Deposit Balance" },
  "deposit.select_method": { id: "Pilih Metode Pembayaran", en: "Select Payment Method" },
  "deposit.amount": { id: "Nominal Deposit", en: "Deposit Amount" },
  "deposit.trx_id": { id: "ID Transaksi", en: "Transaction ID" },
  "deposit.trx_id_placeholder": { id: "Masukkan ID transaksi setelah transfer", en: "Enter transaction ID after transfer" },
  "deposit.send_wa": { id: "Kirim Konfirmasi via WA", en: "Send Confirmation via WA" },
  "deposit.history": { id: "Riwayat Deposit", en: "Deposit History" },
  "deposit.no_history": { id: "Belum ada riwayat deposit.", en: "No deposit history." },
  "deposit.pending": { id: "Menunggu", en: "Pending" },
  "deposit.approved": { id: "Disetujui", en: "Approved" },
  "deposit.rejected": { id: "Ditolak", en: "Rejected" },
  "deposit.qris": { id: "QRIS", en: "QRIS" },
  "deposit.ewallet": { id: "E-Wallet", en: "E-Wallet" },
  "deposit.scan_qris": { id: "Scan QRIS di bawah ini", en: "Scan the QRIS below" },
  "deposit.transfer_to": { id: "Transfer ke", en: "Transfer to" },
  "deposit.btn": { id: "Deposit", en: "Deposit" },

  // General
  "general.close": { id: "Tutup", en: "Close" },
  "general.copy": { id: "Salin", en: "Copy" },
  "general.copied": { id: "Tersalin!", en: "Copied!" },
  "general.loading": { id: "Memuat...", en: "Loading..." },
  "general.language": { id: "Bahasa", en: "Language" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry["id"];
}
