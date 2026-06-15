export interface UpstreamSession {
  token?: string;
  cookies: string[];
  companyId?: string;
  nickname?: string;
}

export interface SearchItem {
  id: string;
  name: string;
  extension: string;
  type: "file" | "folder";
  path: string;
  spaceName: string;
  modifiedAt: string;
  openUrl: string;
}

export interface SearchResult {
  items: SearchItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
