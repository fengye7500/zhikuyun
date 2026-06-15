import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { SessionStore } from "./session-store.js";
import {
  AuthenticationError,
  isNetworkError,
  UpstreamError,
  ZhikuyunClient
} from "./zhikuyun-client.js";

const COOKIE_NAME = "zhikuyun_search_session";

export function createApp(client: ZhikuyunClient, sessions: SessionStore) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const account = typeof req.body?.account === "string" ? req.body.account.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!account || !password || account.length > 200 || password.length > 200) {
        return res.status(400).json({ message: "请输入有效的账号和密码" });
      }
      const upstream = await client.login(account, password);
      const sessionId = sessions.create(upstream);
      res.cookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure || process.env.NODE_ENV === "production",
        maxAge: getSessionTtlMs(),
        path: "/"
      });
      return res.json({ authenticated: true, user: { nickname: upstream.nickname ?? account } });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    sessions.delete(req.cookies[COOKIE_NAME]);
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
    res.status(204).end();
  });

  app.get("/api/auth/status", (req, res) => {
    const session = sessions.get(req.cookies[COOKIE_NAME]);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.json({ authenticated: true, user: { nickname: session.nickname ?? "知库云用户" } });
  });

  app.get("/api/files/search", async (req, res, next) => {
    try {
      const sessionId = req.cookies[COOKIE_NAME];
      const session = sessions.get(sessionId);
      if (!session) return res.status(401).json({ message: "登录状态已失效，请重新登录" });
      const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const refineQuery = typeof req.query.refine === "string" ? req.query.refine.trim() : "";
      const typeQuery = req.query.type === "file" || req.query.type === "folder"
        ? req.query.type
        : "all";
      const extensions = typeof req.query.extensions === "string"
        ? req.query.extensions.split(",").map((value) => value.trim()).filter(Boolean)
        : [];
      const page = boundedInteger(req.query.page, 1, 10_000, 1);
      const pageSize = boundedInteger(req.query.pageSize, 1, 100, 20);
      if (!query) return res.json({ items: [], page, pageSize, total: 0, hasMore: false });
      if (query.length > 100) return res.status(400).json({ message: "搜索关键字不能超过100个字符" });
      if (refineQuery.length > 100) {
        return res.status(400).json({ message: "结果内筛选关键字不能超过100个字符" });
      }
      const result = await client.search(
        session,
        query,
        refineQuery,
        typeQuery,
        extensions,
        page,
        pageSize
      );
      return res.json(result);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        sessions.delete(req.cookies[COOKIE_NAME]);
        res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
      }
      return next(error);
    }
  });

  const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(distPath, { index: false }));
  app.get("/{*path}", (_req, res, next) => {
    res.sendFile(path.join(distPath, "index.html"), (error) => error ? next(error) : undefined);
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ message: error.message });
    }
    if (error instanceof UpstreamError) {
      return res.status(502).json({ message: error.message });
    }
    if (isNetworkError(error)) {
      return res.status(504).json({ message: "连接知库云超时，请稍后重试" });
    }
    console.error("请求处理失败", error instanceof Error ? error.message : "未知错误");
    return res.status(500).json({ message: "服务发生异常，请稍后重试" });
  });

  return app;
}

export function getSessionTtlMs(): number {
  const minutes = Number(process.env.SESSION_TTL_MINUTES ?? 480);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 480) * 60_000;
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
