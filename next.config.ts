import type { NextConfig } from "next";

/**
 * 后端的真实地址（run_api.bat 起的那个 FastAPI）。
 *
 * 注意这是**给 dev server 自己用的**（服务端转发），不是给浏览器用的 ——
 * 浏览器那边只认 .env.local 里的 `NEXT_PUBLIC_API_BASE_URL=/msb`。
 */
const BACKEND = "http://127.0.0.1:8000";

/** 前端走后端代理的路径前缀。改这里要同步改 .env.local 的 NEXT_PUBLIC_API_BASE_URL */
const PROXY_PREFIX = "/msb";

const nextConfig: NextConfig = {
  /**
   * 允许哪些来源访问 dev-only 的资源（HMR 的 WebSocket、`/_next/*` 里的 RSC 产物等）。
   *
   * 默认只放行 localhost 及其子域，于是局域网机器打开 `http://10.x.x.x:3000` 时，
   * 它发来的请求带着 `Origin: http://10.x.x.x:3000`，会被 403 拦掉并打一条
   * "Blocked cross-origin request to Next.js dev resource" —— 症状是页面能打开，
   * 但热更新不工作、切换路由缺资源，看起来像"局域网访问时好时坏"。
   *
   * 这里用通配段而不是写死当前那台机器的 IP：`*` 只匹配**一段**主机名，
   * 所以 10.*.*.* 覆盖整个 10.0.0.0/8 内网段 —— 换 Wi-Fi、换 IP 都不用回来改这里。
   * 只在 dev 生效，`next build` 出来的产物完全不看它。
   */
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],

  /**
   * 同源代理：`/msb/api/*`、`/msb/media/*` → 后端。
   *
   * 为什么需要它：局域网里别人访问的是 `10.x.x.x:3000`，而他浏览器里的 `localhost`
   * 指**他自己那台机器**。所以过去那句 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
   * 在局域网下必然失败（数据拉不到、视频全 404）；改成写死本机 IP 又会在换网段时失效。
   * 走代理后浏览器只跟 3000 说话，由 dev server 在**同一台机器上**转发给后端 ——
   * 顺带把 CORS 也消掉了（同源），而且换机器、换 IP 都不用改任何配置。
   *
   * ⚠️ 用的是独立前缀 /msb，不直接吃 /api/*：
   *    `src/app/api/` 下有一整套 Mock 的 Route Handler，同前缀会跟它抢路由，
   *    "Mock 模式和真后端到底谁接了这一发"是那种极难排查的问题。
   * ⚠️ 这里是**dev server 转发**，只在本机跑着前端时才成立（生产要换成网关反代）。
   */
  async rewrites() {
    return [{ source: `${PROXY_PREFIX}/:path*`, destination: `${BACKEND}/:path*` }];
  },
};

export default nextConfig;
