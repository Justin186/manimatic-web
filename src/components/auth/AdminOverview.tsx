"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, HardDrive, RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge as BadgePill } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { fetchOverview, runCleanup, type AdminOverview } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * 后台「概览」。
 *
 * ============================================================================
 * 这一屏回答四个最常被问的问题（而不是罗列所有能拿到的东西）
 * ============================================================================
 *   1. 服务还活着吗 —— 版本 / LaTeX / ffmpeg / 当前模型
 *   2. 有多少人、多少条会话
 *   3. **磁盘被谁占着** —— 谁最占地方、有没有"没有归属"的老数据、
 *      有没有"账号删了数据还在"的孤儿分区
 *   4. **有什么需要现在处理** —— 这条最要紧：它是"没人盯着就会出事"的清单
 *
 * ⚠️ 刻意**不做图表和趋势**：那些要读留档、按天聚合，成本远大于收益，
 *    而这个后台的定位是"一眼看清现状 + 把该处理的事指出来"。
 *    数据是**拉一次的快照**，所以给了刷新按钮，界面不假装自己是实时的。
 */
export function AdminOverview() {
  const toast = useToast();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /** 刷新按钮用：它要转圈。首次加载**不能用它** —— 见下面的注释。 */
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      setData(await fetchOverview());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * 首次加载。
   *
   * ⚠️ 这里**不能**直接调 `reload()`：它一进来就 `setBusy(true)`，而 effect
   *    体内同步 setState 会触发级联渲染（react-hooks/set-state-in-effect）。
   *    改成"在 promise 回调里 setState"就合规了 —— 回调是异步的，
   *    不属于"effect 体内同步设置"。
   */
  useEffect(() => {
    let alive = true;
    void fetchOverview()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError("");
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="rounded-inner bg-err-soft px-3 py-2 text-xs leading-relaxed text-err">
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!data) {
    return <p className="text-sm text-fg-subtle">加载中…</p>;
  }

  const { stats, server, config, legacy, orphan, warnings } = data;

  return (
    <div className="space-y-5">
      {/* 该处理的事放最上面：它是这一屏唯一的"要动手"信号 */}
      {warnings.length > 0 && (
        <Card className="border-warn/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warn" />
              需要处理（{warnings.length}）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {warnings.map((w) => (
                <li key={w} className="text-sm leading-relaxed text-fg-muted">
                  · {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ---------------- 用量 ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="账号" value={String(stats.users)}
              hint={`其中管理员 ${stats.admins}`} />
        <Stat icon={<HardDrive className="h-4 w-4" />} label="会话" value={String(stats.threads)}
              hint="按账号分区统计" />
        <Stat icon={<Database className="h-4 w-4" />} label="产物占用" value={fmtBytes(stats.bytes)}
              hint={server.outputDir.split(/[\\/]/).pop() || ""} />
        <Stat icon={<RefreshCw className="h-4 w-4" />} label="渲染并发上限"
              value={String(server.maxRenders)}
              hint={server.ttlDays ? `${server.ttlDays} 天后清理产物` : "产物永久保留"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- 服务状态 ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle>服务状态</CardTitle>
            <CardDescription>
              这里任何一项不合格都会在**渲染时**才炸，所以提前摆出来
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <StatusLine ok label="LaTeX" detail={server.latex ? "可用" : server.latex_reason || "不可用"} />
              <StatusLine ok={server.ffmpeg} label="ffmpeg"
                          detail={server.ffmpeg ? "可用" : "未找到（分段无法拼接）"} />
              <StatusLine ok={server.llm.has_key} label="LLM 密钥"
                          detail={server.llm.has_key ? "已配置" : "未配置（生成会直接失败）"} />
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">模型</span>
                <span className="truncate text-right text-fg">
                  {server.llm.model || "—"}
                  {server.llm.profile ? (
                    <span className="ml-1 text-fg-subtle">[{server.llm.profile}]</span>
                  ) : null}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">版本 / 质量档</span>
                <span className="text-fg">
                  v{server.version} · {server.quality}
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* ---------------- 存储去向 ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle>存储去向</CardTitle>
            <CardDescription>
              产物占用按<strong className="font-medium text-fg">文件名前缀</strong>
              归属到账号。下面两类是「有东西、但没人管」的
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-fg-muted">
                    {u.email}
                    {u.isRoot && <span className="ml-1.5"><BadgePill tone="warn">root</BadgePill></span>}
                  </span>
                  <span className="tnum shrink-0 text-fg">
                    {u.threads} 条 · {fmtBytes(u.bytes)}
                  </span>
                </li>
              ))}
              {legacy.threads > 0 && (
                <li className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <span className="text-fg-muted">
                    <span className="text-warn">公共区（老数据）</span>
                  </span>
                  <span className="tnum shrink-0 text-fg">
                    {legacy.threads} 条 · {fmtBytes(legacy.bytes)}
                  </span>
                </li>
              )}
              {orphan.threads > 0 && (
                <li className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <span className="text-fg-muted">
                    <span className="text-warn">已删除账号的数据</span>
                  </span>
                  <span className="tnum shrink-0 text-fg">
                    {orphan.threads} 条 · {fmtBytes(orphan.bytes)}
                  </span>
                </li>
              )}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
              删号<strong className="font-medium text-fg">不会</strong>删除数据
              （视频渲一遍要几分钟，而账号可以重建）。所以删过号的部署会看到
              「已删除账号的数据」占着地方 —— 这是预期行为，要收回空间得手工清目录。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- 部署配置 ---------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>部署配置</CardTitle>
              <CardDescription>
                这些<strong className="font-medium text-fg">只能改环境变量并重启</strong>。
                做成网页开关等于「任何拿到后台的人都能把站门打开」，所以这里只读
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void reload()} disabled={busy}>
                <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
                刷新
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(
                    "清理过期渲染产物？\n\n只删超过保留期限的成片 / 分段 / 增量缓存，" +
                    "**不动**会话记录与分镜。")) return;
                  void (async () => {
                    setBusy(true);
                    try {
                      const r = await runCleanup();
                      const n = Array.isArray(r.removed) ? r.removed.length : 0;
                      toast(n ? `已清理 ${n} 项过期产物` : "没有需要清理的");
                      await reload();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                清理过期产物
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm">
            <CfgLine label="注册" value={config.registerOpen ? "开放（需邀请码）" : "已关闭"} warn={config.registerOpen} />
            <CfgLine label="Cookie Secure" value={config.cookieSecure ? "已开启" : "未开启（仅 HTTP 内网可用）"}
                     warn={!config.cookieSecure} />
            <CfgLine label="登录有效期" value={`${config.sessionDays} 天`} />
            <CfgLine label="账号库" value={config.db} />
          </ul>
          <div className="rounded-inner bg-surface-2 px-3 py-2.5">
            <p className="text-xs font-medium text-fg-muted">上线前逐条过一遍（来自后端 ONLINE_CHECKLIST）</p>
            <ul className="mt-1.5 space-y-1">
              {data.checklist.map((c) => (
                <li key={c} className="text-xs leading-relaxed text-fg-subtle">· {c}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon, label, value, hint,
}: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-fg-subtle">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className="tnum mt-2 font-display text-2xl font-semibold tracking-tight text-fg">
          {value}
        </p>
        {hint ? <p className="mt-0.5 truncate text-xs text-fg-subtle">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function StatusLine({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-fg-muted">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-warn" />
        )}
        {label}
      </span>
      <span className={cn("truncate text-right", ok ? "text-fg" : "text-warn")}>{detail}</span>
    </li>
  );
}

function CfgLine({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className={cn("truncate text-right", warn ? "text-warn" : "text-fg")}>{value}</span>
    </li>
  );
}

/** 文件大小：后台里只需要"量级"，多余的精度反而看不出哪个占地方。 */
function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
