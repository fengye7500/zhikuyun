import { describe, expect, it } from "vitest";
import { SessionStore } from "./session-store.js";
import { normalizeSearchResult } from "./zhikuyun-client.js";

describe("安全约束", () => {
  it("会话存储不要求保存账号密码", () => {
    const store = new SessionStore(60_000);
    const id = store.create({ token: "secret", cookies: ["sid=secret"] });
    const session = store.get(id);
    expect(session).not.toHaveProperty("password");
    expect(session).not.toHaveProperty("account");
  });
});

describe("搜索结果标准化", () => {
  it("只保留文件名包含关键字的结果，并按修改时间倒序", () => {
    const result = normalizeSearchResult(
      {
        rows: [
          { id: "1", name: "无关文件", ext: "pdf", updateTime: "2026-01-03 10:00:00" },
          { id: "2", name: "最佳实践旧版", ext: "pdf", updateTime: "2025-01-01 10:00:00" },
          { id: "3", name: "最佳实践新版", ext: "pdf", updateTime: "2026-01-01 10:00:00" }
        ],
        total: 9999
      },
      "最佳实践",
      "",
      "all",
      [],
      1,
      20,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(result.items.map((item) => item.name)).toEqual([
      "最佳实践新版.pdf",
      "最佳实践旧版.pdf"
    ]);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it("汇总后再分页，较新的跨页文件会排在前面", () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: String(index),
      name: `最佳实践-${index}`,
      ext: "pdf",
      updateTime: index === 20 ? "2026-06-01 20:06:00" : `2025-01-${String(index + 1).padStart(2, "0")} 10:00:00`
    }));

    const result = normalizeSearchResult(
      rows,
      "最佳实践",
      "",
      "all",
      [],
      1,
      20,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(result.items[0].name).toBe("最佳实践-20.pdf");
    expect(result.items).toHaveLength(20);
    expect(result.total).toBe(21);
    expect(result.hasMore).toBe(true);
  });

  it("在主关键字结果内继续应用第二关键字", () => {
    const result = normalizeSearchResult(
      [
        { id: "1", name: "InCloud 性能最佳实践", ext: "pdf", updateTime: "2026-01-01" },
        { id: "2", name: "WinStack 最佳实践", ext: "pdf", updateTime: "2026-01-02" }
      ],
      "最佳实践",
      "InCloud",
      "all",
      [],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(result.items.map((item) => item.name)).toEqual(["InCloud 性能最佳实践.pdf"]);
  });

  it("主搜索不区分大小写，结果内筛选区分大小写", () => {
    const matched = normalizeSearchResult(
      [
        { id: "1", name: "VPN-InCloud 运维手册", ext: "pdf", updateTime: "2026-01-02" },
        { id: "2", name: "VPN-WinStack 运维手册", ext: "pdf", updateTime: "2026-01-01" }
      ],
      "vpn",
      "InCloud",
      "all",
      [],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );
    const unmatched = normalizeSearchResult(
      [{ id: "1", name: "VPN-InCloud 运维手册", ext: "pdf", updateTime: "2026-01-02" }],
      "vpn",
      "incLOUD",
      "all",
      [],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(matched.items.map((item) => item.name)).toEqual(["VPN-InCloud 运维手册.pdf"]);
    expect(unmatched.items).toEqual([]);
  });

  it("支持文件夹和常用文件格式筛选", () => {
    const rows = [
      { id: "1", name: "WinStack 文档", type: "folder", updateTime: "2026-01-03" },
      { id: "2", name: "WinStack 手册", type: "file", ext: "docx", updateTime: "2026-01-02" },
      { id: "3", name: "WinStack 方案", type: "file", ext: "pdf", updateTime: "2026-01-01" }
    ];

    const folders = normalizeSearchResult(
      rows,
      "WinStack",
      "",
      "folder",
      [],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );
    const wordFiles = normalizeSearchResult(
      rows,
      "WinStack",
      "",
      "file",
      ["doc", "docx"],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(folders.items.map((item) => item.name)).toEqual(["WinStack 文档"]);
    expect(wordFiles.items.map((item) => item.name)).toEqual(["WinStack 手册.docx"]);
  });

  it("隐藏内部对象 ID 路径并展示可理解的位置线索", () => {
    const result = normalizeSearchResult(
      [{
        id: "1",
        name: "VPN",
        type: "folder",
        parentPath: "1b2d0d1352ca432fa22613321a4a8940/1c556efaa330440892c41920680ed798",
        group: "department",
        userName: "吴德斌"
      }],
      "VPN",
      "",
      "all",
      [],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(result.items[0].path).toBe("企业文档 / 吴德斌 / 点击查看完整路径");
    expect(result.items[0].path).not.toContain("1b2d0d1352ca432fa22613321a4a8940");
  });

  it("优先展示上游返回的可读目录路径", () => {
    const result = normalizeSearchResult(
      [{ id: "1", name: "VPN", type: "folder", parentPathName: "企业文档/华东区/技术资料" }],
      "VPN",
      "",
      "all",
      [],
      1,
      50,
      "https://pan.winhong.com/netdisk-ui/"
    );

    expect(result.items[0].path).toBe("企业文档/华东区/技术资料");
  });
});
