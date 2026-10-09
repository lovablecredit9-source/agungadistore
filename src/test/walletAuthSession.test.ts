import { describe, it, expect } from "vitest";
import { isSessionFromThisLogin, readOAuthReturnError } from "@/lib/authBridge";

describe("wallet login only uses the session created by this login", () => {
  const now = Date.parse("2026-10-09T04:30:00Z");
  const started = String(now - 60_000);

  it("rejects an older session already in the browser (e.g. admin panel)", () => {
    expect(isSessionFromThisLogin("2026-10-06T12:51:33Z", started, now)).toBe(false);
  });
  it("accepts a session signed in after the Google login started", () => {
    expect(isSessionFromThisLogin(new Date(now - 10_000).toISOString(), started, now)).toBe(true);
  });
  it("tolerates small clock differences", () => {
    expect(isSessionFromThisLogin(new Date(now - 90_000).toISOString(), started, now)).toBe(true);
  });
  it("email-link return without start time only accepts very recent sign-ins", () => {
    expect(isSessionFromThisLogin(new Date(now - 60_000).toISOString(), null, now)).toBe(true);
    expect(isSessionFromThisLogin(new Date(now - 60 * 60_000).toISOString(), null, now)).toBe(false);
  });
  it("rejects missing sign-in time", () => {
    expect(isSessionFromThisLogin(undefined, started, now)).toBe(false);
  });
  it("reads the real error from the return URL", () => {
    expect(readOAuthReturnError({ search: "?error=access_denied&error_description=User+cancelled", hash: "" })).toBe("User cancelled");
    expect(readOAuthReturnError({ search: "", hash: "#error=server_error" })).toBe("server_error");
    expect(readOAuthReturnError({ search: "?tab=saldo", hash: "" })).toBeNull();
  });
});
