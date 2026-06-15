import { describe, expect, it, vi } from "vitest";
import { SessionStore } from "./session-store.js";

describe("SessionStore", () => {
  it("隔离并读取不同用户会话", () => {
    const store = new SessionStore(60_000);
    const first = store.create({ cookies: [], nickname: "用户甲" });
    const second = store.create({ cookies: [], nickname: "用户乙" });
    expect(first).not.toBe(second);
    expect(store.get(first)?.nickname).toBe("用户甲");
    expect(store.get(second)?.nickname).toBe("用户乙");
  });

  it("会话过期后自动失效", () => {
    vi.useFakeTimers();
    const store = new SessionStore(1_000);
    const id = store.create({ cookies: [] });
    vi.advanceTimersByTime(1_001);
    expect(store.get(id)).toBeUndefined();
    vi.useRealTimers();
  });
});
