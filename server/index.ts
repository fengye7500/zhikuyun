import { createApp, getSessionTtlMs } from "./app.js";
import { SessionStore } from "./session-store.js";
import { ZhikuyunClient } from "./zhikuyun-client.js";

const port = Number(process.env.PORT ?? 3000);
const client = new ZhikuyunClient({
  baseUrl: process.env.ZHIKUYUN_BASE_URL ?? "https://pan.winhong.com",
  loginPath: process.env.ZHIKUYUN_LOGIN_PATH ?? "/netdisk-api/usercenter/login",
  userInfoPath: process.env.ZHIKUYUN_USERINFO_PATH ?? "/netdisk-api/usercenter/userinfo",
  searchPath: process.env.ZHIKUYUN_SEARCH_PATH ?? "/netdisk-api/netdisk/objectList",
  webUrl: process.env.ZHIKUYUN_WEB_URL ?? "https://pan.winhong.com/netdisk-ui/"
});

createApp(client, new SessionStore(getSessionTtlMs())).listen(port, "0.0.0.0", () => {
  console.log(`知库云搜索服务已启动：http://localhost:${port}`);
});
