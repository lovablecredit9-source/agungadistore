import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { StorePremiumHomeCard, GemMembershipHomeCard } from "@/components/wallet/StorePremiumHomeCard";
import { storePremiumHomeState, formatWib } from "@/components/wallet/membershipHomeState";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const chan = { on: () => chan, subscribe: () => chan };
  return { supabase: { rpc: (...a: unknown[]) => rpcMock(...a), channel: () => chan, removeChannel: () => {} } };
});

import { useStorePremium } from "@/hooks/useStorePremium";

const NOW = Date.parse("2026-10-09T00:00:00Z");
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();
const base = { isPremium: false, isLocked: false, expiresAt: null as string | null, planName: null as string | null, daysLeft: 0, lockedUntil: null as string | null };

describe("Premium Toko home card", () => {
  it("CASE 1: not premium → no AKTIF badge, no expiry date", () => {
    render(<StorePremiumHomeCard premium={base} activeBenefitCount={6} onOpen={() => {}} now={NOW} />);
    const card = screen.getByTestId("store-premium-card");
    expect(card.dataset.state).toBe("none");
    expect(screen.getByText("Belum aktif")).toBeTruthy();
    expect(screen.queryByText("AKTIF")).toBeNull();
    expect(card.textContent).not.toMatch(/WIB/);
  });

  it("CASE 2: active → gold card with AKTIF, plan, backend days and expiry", () => {
    const exp = inDays(29.5);
    render(<StorePremiumHomeCard premium={{ ...base, isPremium: true, planName: "Premium 1 Bulan", expiresAt: exp, daysLeft: 30 }} activeBenefitCount={4} onOpen={() => {}} now={NOW} />);
    const card = screen.getByTestId("store-premium-card");
    expect(card.dataset.state).toBe("active");
    expect(screen.getByText("AKTIF")).toBeTruthy();
    expect(screen.getByText("Premium 1 Bulan")).toBeTruthy();
    expect(screen.getByText("30 hari")).toBeTruthy();
    expect(screen.getByText(formatWib(exp)!)).toBeTruthy();
    expect(screen.getByText("4 benefit aktif")).toBeTruthy();
    expect(card.className).toMatch(/via-amber-500/);
  });

  it("CASE 3: expired → not AKTIF even if a stale state says premium", () => {
    expect(storePremiumHomeState({ isPremium: true, isLocked: false, expiresAt: inDays(-1) }, NOW)).toBe("none");
    render(<StorePremiumHomeCard premium={{ ...base, isPremium: true, planName: "Premium 1 Bulan", expiresAt: inDays(-1), daysLeft: 0 }} activeBenefitCount={4} onOpen={() => {}} now={NOW} />);
    expect(screen.queryByText("AKTIF")).toBeNull();
  });

  it("CASE 4: locked → 'Premium dikunci', never AKTIF", () => {
    render(<StorePremiumHomeCard premium={{ ...base, isLocked: true, planName: "Premium 1 Bulan", expiresAt: inDays(10), daysLeft: 10, lockedUntil: inDays(2) }} activeBenefitCount={4} onOpen={() => {}} now={NOW} />);
    expect(screen.getByTestId("store-premium-card").dataset.state).toBe("locked");
    expect(screen.getByText("Premium dikunci")).toBeTruthy();
    expect(screen.queryByText("AKTIF")).toBeNull();
  });

  it("unknown benefit count falls back to plain text, no invented number", () => {
    render(<StorePremiumHomeCard premium={{ ...base, isPremium: true, planName: "P", expiresAt: inDays(20), daysLeft: 20 }} activeBenefitCount={null} onOpen={() => {}} now={NOW} />);
    expect(screen.getByText("Membership Premium aktif")).toBeTruthy();
  });
});

describe("CASE 5/6: admin grant or purchase → card follows get_store_premium_info", () => {
  beforeEach(() => rpcMock.mockReset());
  it("refetches on refresh-store-premium and flips to premium only when backend says so", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ is_premium: false, plan_name: null, expires_at: null, days_left: 0, is_locked: false }] });
    const { result } = renderHook(() => useStorePremium("v1"));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("get_store_premium_info", { p_visitor_id: "v1" }));
    expect(result.current.isPremium).toBe(false);
    const exp = new Date(Date.now() + 29 * 86_400_000).toISOString();
    rpcMock.mockResolvedValueOnce({ data: [{ is_premium: true, plan_name: "Premium 1 Bulan", expires_at: exp, days_left: 29, is_locked: false }] });
    await act(async () => { window.dispatchEvent(new Event("refresh-store-premium")); });
    await waitFor(() => expect(result.current.isPremium).toBe(true));
    expect(result.current.planName).toBe("Premium 1 Bulan");
    expect(result.current.daysLeft).toBe(29);
  });
});

describe("CASE 7: Membership Gem stays separate", () => {
  it("renders its own cyan Gem card and label, independent of Premium Toko", () => {
    render(<>
      <GemMembershipHomeCard sub={{ plan_name: "Mingguan Gem", expires_at: inDays(5) }} loaded onOpen={() => {}} now={NOW} />
      <StorePremiumHomeCard premium={base} activeBenefitCount={3} onOpen={() => {}} now={NOW} />
    </>);
    expect(screen.getByTestId("gem-membership-card").dataset.state).toBe("active");
    expect(screen.getByText("Mingguan Gem")).toBeTruthy();
    expect(screen.getByText("💎 Membership Gem / Streak")).toBeTruthy();
    expect(screen.getByTestId("store-premium-card").dataset.state).toBe("none");
  });
  it("Gem without subscription shows Belum aktif", () => {
    render(<GemMembershipHomeCard sub={null} loaded onOpen={() => {}} now={NOW} />);
    expect(screen.getByTestId("gem-membership-card").dataset.state).toBe("none");
  });
});
