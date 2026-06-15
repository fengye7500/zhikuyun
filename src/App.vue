<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, type SearchItem, type User } from "./api";

const user = ref<User | null>(null);
const checking = ref(true);
const loggingIn = ref(false);
const account = ref("");
const password = ref("");
const loginError = ref("");
const keyword = ref("");
const refineKeyword = ref("");
const itemType = ref<"all" | "file" | "folder">("all");
const selectedFormats = ref<string[]>([]);
const items = ref<SearchItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 50;
const hasMore = ref(false);
const loading = ref(false);
const searchError = ref("");
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
const formatOptions = [
  { label: "PDF", extensions: ["pdf"] },
  { label: "Word", extensions: ["doc", "docx"] },
  { label: "Excel", extensions: ["xls", "xlsx", "csv"] },
  { label: "PPT", extensions: ["ppt", "pptx"] },
  { label: "图片", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"] },
  { label: "压缩包", extensions: ["zip", "rar", "7z", "tar", "gz"] },
  { label: "文本", extensions: ["txt", "md", "log"] }
];

onMounted(async () => {
  try {
    user.value = (await api.status()).user;
  } catch {
    user.value = null;
  } finally {
    checking.value = false;
  }
});

watch(keyword, () => {
  page.value = 1;
  refineKeyword.value = "";
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void search(), 350);
});

watch(refineKeyword, () => {
  page.value = 1;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void search(), 250);
});

watch([itemType, selectedFormats], () => {
  page.value = 1;
  if (itemType.value !== "file") selectedFormats.value = [];
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void search(), 100);
}, { deep: true });

async function login() {
  loginError.value = "";
  loggingIn.value = true;
  try {
    const result = await api.login(account.value, password.value);
    user.value = result.user;
    password.value = "";
  } catch (error) {
    loginError.value = messageOf(error);
  } finally {
    loggingIn.value = false;
  }
}

async function logout() {
  await api.logout().catch(() => undefined);
  user.value = null;
  items.value = [];
  keyword.value = "";
  refineKeyword.value = "";
  itemType.value = "all";
  selectedFormats.value = [];
  account.value = "";
  password.value = "";
}

async function search(force = false) {
  clearTimeout(debounceTimer);
  if (!keyword.value.trim()) {
    controller?.abort();
    items.value = [];
    total.value = 0;
    hasMore.value = false;
    searchError.value = "";
    return;
  }
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  searchError.value = "";
  try {
    const result = await api.search(
      keyword.value.trim(),
      refineKeyword.value.trim(),
      itemType.value,
      selectedExtensions(),
      page.value,
      pageSize,
      controller.signal
    );
    items.value = result.items;
    total.value = result.total;
    hasMore.value = result.hasMore;
    page.value = result.page;
  } catch (error) {
    if ((error as Error).name === "AbortError") return;
    if ((error as Error & { status?: number }).status === 401) {
      user.value = null;
      items.value = [];
      loginError.value = "登录状态已失效，请重新登录";
      return;
    }
    searchError.value = messageOf(error);
  } finally {
    if (!controller?.signal.aborted || force) loading.value = false;
  }
}

function selectedExtensions() {
  return formatOptions
    .filter((option) => selectedFormats.value.includes(option.label))
    .flatMap((option) => option.extensions);
}

function toggleFormat(label: string) {
  selectedFormats.value = selectedFormats.value.includes(label)
    ? selectedFormats.value.filter((item) => item !== label)
    : [...selectedFormats.value, label];
}

function changePage(next: number) {
  if (next < 1 || next === page.value || (next > page.value && !hasMore.value)) return;
  page.value = next;
  void search(true);
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.getTime() === 0
    ? "时间未知"
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(date);
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
</script>

<template>
  <main v-if="checking" class="center-state">正在检查登录状态...</main>

  <main v-else-if="!user" class="login-shell">
    <section class="brand-panel">
      <div class="brand-mark">Z</div>
      <p class="eyebrow">WINHONG KNOWLEDGE CLOUD</p>
      <h1>更快找到<br />需要的文件</h1>
      <p class="brand-copy">连接知库云，以文件名快速检索，并按最后修改时间自动倒序排列。</p>
      <div class="security-note">账号密码仅用于本次登录，不会写入浏览器存储或项目文件。</div>
    </section>

    <section class="login-panel">
      <form class="login-card" @submit.prevent="login">
        <p class="eyebrow blue">团队文件搜索</p>
        <h2>登录知库云</h2>
        <p class="subtle">请使用你自己的知库云账号</p>
        <label>
          <span>账号</span>
          <input v-model="account" autocomplete="username" placeholder="邮箱 / 手机号 / 用户号" required />
        </label>
        <label>
          <span>密码</span>
          <input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" required />
        </label>
        <p v-if="loginError" class="error">{{ loginError }}</p>
        <button class="primary-button" :disabled="loggingIn">
          {{ loggingIn ? "正在登录..." : "安全登录" }}
        </button>
      </form>
    </section>
  </main>

  <main v-else class="app-shell">
    <header>
      <div class="logo-line">
        <div class="brand-mark small">Z</div>
        <div>
          <strong>知库云快速搜索</strong>
          <span>内部文件检索工具</span>
        </div>
      </div>
      <div class="user-box">
        <span>{{ user.nickname }}</span>
        <button class="text-button" @click="logout">退出</button>
      </div>
    </header>

    <section class="hero">
      <p class="eyebrow">全部文档 · 修改时间倒序</p>
      <h1>搜索团队文件</h1>
      <form class="search-box" @submit.prevent="search(true)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
        </svg>
        <input v-model="keyword" maxlength="100" autofocus placeholder="输入文件名，例如：项目方案、故障报告..." />
        <button type="submit">搜索</button>
      </form>
      <p class="search-tip">主搜索英文不区分大小写，按回车可立即刷新结果</p>
      <div v-if="keyword.trim()" class="refine-box">
        <span>结果内筛选（英文区分大小写）</span>
        <input
          v-model="refineKeyword"
          maxlength="100"
          placeholder="在当前搜索结果中继续输入关键字，例如：InCloud、性能"
        />
        <button v-if="refineKeyword" type="button" @click="refineKeyword = ''">清除</button>
        <div class="filter-row">
          <span>搜索类型</span>
          <div class="filter-options">
            <button
              v-for="option in [{ label: '全部', value: 'all' }, { label: '文件', value: 'file' }, { label: '文件夹', value: 'folder' }]"
              :key="option.value"
              type="button"
              class="filter-chip"
              :class="{ active: itemType === option.value }"
              @click="itemType = option.value as 'all' | 'file' | 'folder'"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div v-if="itemType === 'file'" class="filter-row format-row">
          <span>常用格式</span>
          <div class="filter-options">
            <button
              v-for="option in formatOptions"
              :key="option.label"
              type="button"
              class="filter-chip"
              :class="{ active: selectedFormats.includes(option.label) }"
              @click="toggleFormat(option.label)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="results">
      <div class="result-heading">
        <div>
          <h2>搜索结果 <span class="sort-label">按修改时间倒序</span></h2>
          <p v-if="keyword && !loading">
            <template v-if="refineKeyword">“{{ keyword }}” + “{{ refineKeyword }}”复合搜索，</template>
            <template v-if="itemType !== 'all'">{{ itemType === "file" ? "文件" : "文件夹" }}筛选，</template>
            <template v-if="selectedFormats.length">{{ selectedFormats.join("、") }}格式，</template>
            第 {{ page }} 页，共显示 {{ items.length }} 个匹配项
          </p>
        </div>
        <button v-if="keyword" class="refresh-button" :disabled="loading" @click="search(true)">重新加载</button>
      </div>

      <div v-if="loading" class="center-state compact">正在从知库云搜索...</div>
      <div v-else-if="searchError" class="empty-state error-state">
        <strong>搜索未完成</strong>
        <p>{{ searchError }}</p>
      </div>
      <div v-else-if="!keyword" class="empty-state">
        <strong>输入文件名开始搜索</strong>
        <p>结果会自动按最后修改时间从新到旧排列。</p>
      </div>
      <div v-else-if="items.length === 0" class="empty-state">
        <strong>没有找到匹配文件</strong>
        <p>可以尝试缩短关键字或检查文件名。</p>
      </div>

      <div v-else class="result-list">
        <a v-for="item in items" :key="`${item.id}-${item.path}`" class="result-card" :href="item.openUrl" target="_blank" rel="noopener noreferrer">
          <div class="file-icon" :class="{ folder: item.type === 'folder' }">
            {{ item.type === "folder" ? "夹" : (item.extension || "文").slice(0, 3).toUpperCase() }}
          </div>
          <div class="file-main">
            <h3>{{ item.name }}</h3>
            <p class="path" :title="item.path">
              <span class="path-label">位置</span>{{ item.path }}
            </p>
            <div class="meta">
              <span>{{ item.spaceName }}</span>
              <span>{{ item.type === "folder" ? "文件夹" : (item.extension || "文件").toUpperCase() }}</span>
            </div>
          </div>
          <div class="time">
            <span>最后修改</span>
            <strong>{{ formatDate(item.modifiedAt) }}</strong>
          </div>
          <span class="open-arrow">↗</span>
        </a>
      </div>

      <nav v-if="(page > 1 || hasMore) && !loading" class="pagination" aria-label="搜索结果分页">
        <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
        <span>第 {{ page }} 页</span>
        <button :disabled="!hasMore" @click="changePage(page + 1)">下一页</button>
      </nav>
    </section>
  </main>
</template>
