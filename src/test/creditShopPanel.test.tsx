import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

type Q = Record<string, unknown>;
const quote = (o: Partial<Q>): Q => ({
  package_id: "p", label: "Paket", credits: 10, is_unlimited: false, unlimited_days: 0, price: 10000,
  flash_pct: 0, flash_discount: 0, member_pct: 0, member_discount: 0, voucher_discount: 0, voucher_error: null, final_price: 10000, ...o,
});

const state = vi.hoisted(() => ({
  quotes: [] as Record<string, unknown>[],
  main: 50000, game: 0,
  invoke: null as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "game_balance" ? { amount: state.game } : { balance: state.main } }) }) }),
  });
  state.invoke = vi.fn();
  return { supabase: { from, functions: { invoke: (...a: unknown[]) => state.invoke(...a) } } };
});
vi.mock("@/components/games/GameBalance", () => ({ triggerGameBalanceRefresh: vi.fn() }));
vi.mock("@/components/CountUp", () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));

import CreditShopPanel from "@/components/games/CreditShop";

function setupInvoke(purchase: () => Promise<unknown>, voucherOk = true) {
  state.invoke.mockImplementation(async (_fn: string, { body }: { body: Q }) => {
    switch (body.action) {
      case "quote_all": return { data: { quotes: state.quotes }, error: null };
      case "get_credits": return { data: { credits: 5, is_unlimited: false, unlimited_until: null }, error: null };
      case "check_voucher": return voucherOk ? { data: { discount_amount: 1000 }, error: null } : { data: { error: "Voucher sudah habis" }, error: null };
      case "quote": return { data: { quote: state.quotes.find(q => q.package_id === body.packageId) }, error: null };
      case "purchase": return purchase();
    }
    return { data: null, error: null };
  });
}

beforeEach(() => {
  state.main = 50000; state.game = 0;
  state.quotes = [
    quote({ package_id: "a", label: "Starter", credits: 10, price: 10000, final_price: 10000 }),
    quote({ package_id: "b", label: "Hemat", credits: 100, price: 80000, final_price: 80000 }),
  ];
});

describe("CreditShopPanel", () => {
  it("menampilkan paket & harga dari server, harga per kredit, dan badge worth it berdasarkan data", async () => {
    setupInvoke(async () => ({ data: null, error: null }));
    render(<CreditShopPanel visitorId="v1" />);
    const cards = await screen.findAllByTestId("credit-package");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Rp10.000")).toBeInTheDocument();
    expect(screen.getByText("Rp80.000")).toBeInTheDocument();
    expect(screen.getByText("≈ Rp800 / kredit")).toBeInTheDocument();
    // Paket worth it (Rp800/kredit) ditampilkan paling atas; Starter (Rp1.000/kredit) tidak diberi badge.
    expect(within(cards[0]).getByText(/PALING WORTH IT/)).toBeInTheDocument();
    expect(within(cards[0]).getByText("Hemat")).toBeInTheDocument();
    expect(within(cards[1]).queryByText(/PALING WORTH IT/)).toBeNull();
    expect(screen.queryByText(/FLASH OFFER/)).toBeNull();
    // Saldo Utama 50.000 < 80.000 → kekurangan dijelaskan
    expect(within(cards[0]).getByText("Saldo IN + Saldo Utama kurang Rp30.000")).toBeInTheDocument();
  });

  it("tidak ada badge worth it bila harga per kredit sama; flash tampil hanya dari server", async () => {
    state.quotes = [
      quote({ package_id: "a", credits: 10, price: 10000, final_price: 8000, flash_pct: 20, flash_discount: 2000 }),
      quote({ package_id: "b", credits: 20, price: 20000, final_price: 16000, flash_pct: 20, flash_discount: 4000 }),
    ];
    setupInvoke(async () => ({ data: null, error: null }));
    render(<CreditShopPanel visitorId="v1" />);
    await screen.findAllByTestId("credit-package");
    expect(screen.queryByText(/PALING WORTH IT/)).toBeNull();
    expect(screen.getByText(/FLASH OFFER • Hemat hingga 20%/)).toBeInTheDocument();
    expect(screen.getAllByText("Hemat 20%")).toHaveLength(2);
  });

  it("voucher valid dan tidak valid diberi umpan balik", async () => {
    setupInvoke(async () => ({ data: null, error: null }), true);
    const { unmount } = render(<CreditShopPanel visitorId="v1" />);
    fireEvent.change(screen.getByLabelText("Punya kode voucher?"), { target: { value: "promo1" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(await screen.findByText(/Voucher aktif • Hemat Rp1.000/)).toBeInTheDocument();
    unmount();
    setupInvoke(async () => ({ data: null, error: null }), false);
    render(<CreditShopPanel visitorId="v1" />);
    fireEvent.change(screen.getByLabelText("Punya kode voucher?"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(await screen.findByText(/Voucher tidak valid/)).toBeInTheDocument();
  });

  it("alur beli: konfirmasi → PIN 6 digit → satu transaksi walau diklik dua kali → sukses dari respons server", async () => {
    let resolve!: (v: unknown) => void;
    const purchase = vi.fn(() => new Promise(r => { resolve = r; }));
    setupInvoke(purchase);
    const events: string[] = [];
    const onEv = (e: Event) => events.push(e.type);
    window.addEventListener("game-credits-refresh", onEv);
    window.addEventListener("balance-updated", onEv);
    const onPurchased = vi.fn();
    render(<CreditShopPanel visitorId="v1" onPurchased={onPurchased} />);

    fireEvent.click(await screen.findByRole("button", { name: /^Beli Starter/ }));
    expect(await screen.findByText("Konfirmasi Pembelian")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan/ }));

    const pin = await screen.findByLabelText("PIN 6 digit");
    const payBtn = screen.getByRole("button", { name: /Bayar Sekarang/ });
    fireEvent.change(pin, { target: { value: "12a34" } });
    expect(payBtn).toBeDisabled();
    fireEvent.change(pin, { target: { value: "123456" } });
    expect(payBtn).not.toBeDisabled();
    fireEvent.click(payBtn);
    fireEvent.submit(pin.closest("form")!);
    await waitFor(() => expect(screen.getByRole("button", { name: /Memproses/ })).toBeDisabled());
    resolve({ data: { credits: 15, final_price: 10000, source_label: "Saldo Utama", balance_remaining: 40000, game_balance_remaining: 0, trx_id: "#12345", package: { label: "Starter" } }, error: null });

    expect(await screen.findByText("✨ PEMBELIAN BERHASIL!")).toBeInTheDocument();
    expect(purchase).toHaveBeenCalledTimes(1);
    expect(screen.getByText("+10 Kredit")).toBeInTheDocument();
    expect(screen.getByText("#12345")).toBeInTheDocument();
    expect(screen.getByText("Rp40.000", { selector: "dd" })).toBeInTheDocument();
    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(events).toEqual(expect.arrayContaining(["game-credits-refresh", "balance-updated"]));
    window.removeEventListener("game-credits-refresh", onEv);
    window.removeEventListener("balance-updated", onEv);
  });

  it("PIN salah memakai pesan creditErrorMessage, bukan error mentah", async () => {
    setupInvoke(async () => ({ data: { error: "PIN salah", needPin: true }, error: null }));
    render(<CreditShopPanel visitorId="v1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Beli Starter/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Lanjutkan/ }));
    fireEvent.change(await screen.findByLabelText("PIN 6 digit"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Bayar Sekarang/ }));
    expect(await screen.findByText("PIN salah. Silakan coba lagi.")).toBeInTheDocument();
    expect(screen.queryByText(/non-2xx/)).toBeNull();
  });

  it("sumber pembayaran: pilih Saldo IN membuat paket tidak cukup", async () => {
    state.game = 5000;
    setupInvoke(async () => ({ data: null, error: null }));
    render(<CreditShopPanel visitorId="v1" />);
    const starter = await screen.findByRole("button", { name: /^Beli Starter/ });
    await waitFor(() => expect(within(starter).queryByText(/kurang/)).toBeNull());
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(within(starter).getByText("Saldo IN kurang Rp5.000")).toBeInTheDocument();
  });
});
