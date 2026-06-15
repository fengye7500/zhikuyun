import axios, { AxiosError, type AxiosInstance } from "axios";
import { createCipheriv } from "node:crypto";
import type { SearchItem, SearchResult, UpstreamSession } from "./types.js";

type UnknownRecord = Record<string, unknown>;

export class AuthenticationError extends Error {}
export class UpstreamError extends Error {}

export interface ClientConfig {
  baseUrl: string;
  loginPath: string;
  userInfoPath: string;
  searchPath: string;
  webUrl: string;
  timeoutMs?: number;
}

export class ZhikuyunClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: ClientConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs ?? 15_000,
      validateStatus: () => true
    });
  }

  async login(account: string, password: string): Promise<UpstreamSession> {
    const response = await this.http.post(
      this.config.loginPath,
      {
        account,
        password: encryptPassword(password),
        remember: false,
        verifyTimes: 1
      },
      { headers: { "Content-Type": "application/json" } }
    );
    const body = asRecord(response.data);
    if (response.status >= 400 || Number(body.status ?? response.status) !== 200) {
      throw new AuthenticationError("账号或密码错误，或当前账号无法登录");
    }

    const data = asRecord(body.data);
    const token = pickString(data, ["token", "accessToken"]) ||
      pickString(body, ["token", "accessToken"]);
    const cookies = normalizeSetCookie(response.headers["set-cookie"]);
    const session: UpstreamSession = {
      token,
      cookies,
      companyId: extractCompanyId(data) ?? extractCompanyId(body),
      nickname: pickString(data, ["nickname", "name"])
    };

    await this.enrichSession(session);
    return session;
  }

  async search(
    session: UpstreamSession,
    keyword: string,
    refineKeyword: string,
    itemType: "all" | "file" | "folder",
    extensions: string[],
    page: number,
    pageSize: number
  ): Promise<SearchResult> {
    const upstreamPageSize = 20;
    const maxUpstreamPages = 10;
    const fetchPage = async (upstreamPage: number): Promise<unknown[]> => {
      const response = await this.http.get(this.config.searchPath, {
        headers: this.authHeaders(session),
        params: {
          companyId: session.companyId,
          keyword,
          page: upstreamPage,
          pageNum: upstreamPage,
          pageSize: upstreamPageSize,
          sort: 3,
          searchType: "",
          fileType: "",
          fileSize: "",
          timeFrame: ""
        }
      });
      const body = asRecord(response.data);
      const status = Number(body.status ?? response.status);
      if (response.status === 401 || response.status === 403 || status === 403) {
        throw new AuthenticationError("登录状态已失效，请重新登录");
      }
      if (response.status >= 400 || status !== 200) {
        throw new UpstreamError("知库云搜索服务暂时不可用");
      }
      return extractRows(body.data);
    };

    // 知库云固定按约20条分页且总数不准确，并行汇总前10页后再做全局排序。
    const pages = await Promise.all(
      Array.from({ length: maxUpstreamPages }, (_, index) => fetchPage(index + 1))
    );
    const allRows = pages.flat();

    return normalizeSearchResult(
      allRows,
      keyword,
      refineKeyword,
      itemType,
      extensions,
      page,
      pageSize,
      this.config.webUrl
    );
  }

  private async enrichSession(session: UpstreamSession): Promise<void> {
    if (session.companyId && session.nickname) return;
    const response = await this.http.get(this.config.userInfoPath, {
      headers: this.authHeaders(session)
    });
    const body = asRecord(response.data);
    if (response.status >= 400 || Number(body.status ?? response.status) !== 200) return;
    const data = asRecord(body.data);
    session.nickname ||= pickString(data, ["nickname", "name"]);
    session.companyId ||= extractCompanyId(data);
  }

  private authHeaders(session: UpstreamSession): Record<string, string> {
    const headers: Record<string, string> = {};
    if (session.token) {
      const authorization = session.token.startsWith("Bearer ")
        ? session.token
        : `Bearer ${session.token}`;
      headers["X-Authorization"] = authorization;
      headers.Authorization = authorization;
      headers.token = session.token;
    }
    if (session.cookies.length) headers.Cookie = session.cookies.join("; ");
    return headers;
  }
}

export function normalizeSearchResult(
  raw: unknown,
  keyword: string,
  refineKeyword: string,
  itemType: "all" | "file" | "folder",
  extensions: string[],
  page: number,
  pageSize: number,
  webUrl: string
): SearchResult {
  const rows = extractRows(raw);
  const normalizedKeyword = keyword.toLocaleLowerCase();
  const exactRefineKeyword = refineKeyword.trim();
  const normalizedExtensions = new Set(extensions.map((value) => value.toLocaleLowerCase()));
  const uniqueItems = new Map<string, SearchItem>();
  rows
    .map((value) => normalizeItem(asRecord(value), webUrl))
    .filter((item) => item.name.toLocaleLowerCase().includes(normalizedKeyword))
    .filter((item) =>
      !exactRefineKeyword ||
      item.name.includes(exactRefineKeyword)
    )
    .filter((item) => itemType === "all" || item.type === itemType)
    .filter((item) =>
      itemType !== "file" ||
      normalizedExtensions.size === 0 ||
      normalizedExtensions.has(item.extension.toLocaleLowerCase())
    )
    .forEach((item) => uniqueItems.set(item.id || `${item.path}/${item.name}`, item));
  const sortedItems = [...uniqueItems.values()]
    .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  const start = (page - 1) * pageSize;
  const items = sortedItems.slice(start, start + pageSize);
  const total = sortedItems.length;
  return {
    items,
    page,
    pageSize,
    total,
    hasMore: start + pageSize < total
  };
}

function extractRows(raw: unknown): unknown[] {
  const data = asRecord(raw);
  const candidates = [data.rows, data.list, data.child, data.content, raw];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? [];
}

function normalizeItem(row: UnknownRecord, webUrl: string): SearchItem {
  const type = String(row.type ?? row.objectType).toLowerCase() === "folder"
    ? "folder"
    : "file";
  const extension = type === "folder" ? "" : pickString(row, ["ext", "extension"]) ?? "";
  const rawName = pickString(row, ["searchName", "name", "objectName"]) ?? "未命名文件";
  const name = extension && !rawName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
    ? `${stripHighlight(rawName)}.${extension}`
    : stripHighlight(rawName);
  const id = String(row.id ?? row.objectId ?? "");
  const parentId = String(row.parentId ?? row.parentObjectId ?? "");
  const spaceName = pickString(row, ["companyName", "teamName", "departmentName", "fromName"]) ??
    inferSpaceName(row);
  const path = normalizeDisplayPath(row, spaceName);
  const modifiedAt = normalizeDate(row.updateTime ?? row.modifiedTime ?? row.modifyTime ?? row.createTime);
  const route = type === "folder" && id
    ? `#/user/${encodeURIComponent(id)}`
    : parentId
      ? `#/user/${encodeURIComponent(parentId)}`
      : "#/all";
  return { id, name, extension, type, path, spaceName, modifiedAt, openUrl: new URL(route, webUrl).href };
}

function normalizeDisplayPath(row: UnknownRecord, spaceName: string): string {
  const candidate = pickString(row, ["pathName", "parentPathName", "fullPath", "parentPath", "path"]);
  if (candidate && !isObjectIdPath(candidate)) return candidate;

  const owner = pickString(row, ["userName", "updateUserNickName", "createUser"]);
  return [spaceName, owner, "点击查看完整路径"].filter(Boolean).join(" / ");
}

function isObjectIdPath(value: string): boolean {
  const segments = value.split("/").filter(Boolean);
  return segments.length > 0 && segments.every((segment) => /^[a-f\d]{24,}$/i.test(segment));
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function pickString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function extractCompanyId(data: UnknownRecord): string | undefined {
  const direct = pickString(data, ["companyId", "currentCompanyId"]);
  if (direct) return direct;
  const company = asRecord(data.company ?? data.currentCompany);
  return pickString(company, ["id", "companyId"]);
}

function normalizeSetCookie(value: string[] | string | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => item.split(";")[0]).filter(Boolean);
}

function normalizeDate(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
  }
  if (typeof value === "string" && value) {
    const timestamp = Date.parse(value.replace(/-/g, "/"));
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString();
  }
  return new Date(0).toISOString();
}

function inferSpaceName(row: UnknownRecord): string {
  const from = String(row.from ?? row.sourceType ?? row.group ?? "");
  if (from.includes("dept") || from.includes("department")) return "企业文档";
  if (from.includes("group") || from.includes("team")) return "群组文档";
  if (from.includes("user")) return "个人文档";
  return "全部文档";
}

function stripHighlight(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function encryptPassword(password: string): string {
  const key = Buffer.from("zhiku_aespwd_key", "utf8");
  const iv = Buffer.from("zhiku_aespwd_kiv", "utf8");
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(password, "utf8"), cipher.final()]).toString("base64");
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof AxiosError && (!error.response || error.code === "ECONNABORTED");
}
