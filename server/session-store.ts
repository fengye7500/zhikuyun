import { randomBytes } from "node:crypto";
import type { UpstreamSession } from "./types.js";

interface SessionRecord {
  upstream: UpstreamSession;
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly ttlMs: number) {}

  create(upstream: UpstreamSession): string {
    const id = randomBytes(32).toString("base64url");
    this.sessions.set(id, { upstream, expiresAt: Date.now() + this.ttlMs });
    return id;
  }

  get(id: string | undefined): UpstreamSession | undefined {
    if (!id) return undefined;
    const record = this.sessions.get(id);
    if (!record) return undefined;
    if (record.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    record.expiresAt = Date.now() + this.ttlMs;
    return record.upstream;
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }
}
