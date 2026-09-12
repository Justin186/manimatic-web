"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";

import { fetchLlmProfiles, saveLlmProfile, setLlmActive, USE_MOCK } from "@/lib/api";
import type { LlmProfile, LlmProfilesResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Separator } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * 模型设置（设置页）。
 *
 * 三件必须说清楚的事，都直接写在界面上：
 *
 * 1. **密钥不进浏览器**。密钥存在后端（MathStoryboard/llm.local.json），
 *    这里只能提交、不能读取回显。`NEXT_PUBLIC_*` 会被打进浏览器那份 JS，放那儿等于公开。
 * 2. **改完不用重启服务**。后端每次调用都会现读配置文件，所以切完立刻生效。
 * 3. **"密钥留空" = 不改**。因为读不回旧密钥，留空若被当成清空，
 *    用户每改一次模型名就得重打一遍密钥。（后端也是按这个语义实现的。）
 */
export function ModelSettings() {
  const [data, setData] = useState<LlmProfilesResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchLlmProfiles();
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    }
  }, []);

  useEffect(() => {
    if (USE_MOCK) return;
    // 刻意不写成 `void load()`：effect 体内直接可达的 setState 会被 lint 判为
    // "同步更新"（会级联渲染）。走 promise 回调既避开这点，也顺手拿到
    // "组件已卸载就别再 set"的保护 —— 切到别的页面后请求才回来是常事。
    let alive = true;
    void fetchLlmProfiles().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError("");
      },
      (e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setData(null);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  // Mock 模式下没有真后端，这块显示成"未接入"比显示一堆空数据诚实
  if (USE_MOCK) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>模型 API</CardTitle>
          <CardDescription>当前是 Mock 模式，没有真实模型可配</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-soft">
            改 <code className="rounded bg-canvas px-1">web/.env.local</code> 里的
            <code className="mx-1 rounded bg-canvas px-1">NEXT_PUBLIC_USE_MOCK=false</code>
            切到真后端后，这里会列出所有模型档案、可以切换和新增。
          </p>
        </CardContent>
      </Card>
    );
  }

  async function switchTo(name: string) {
    setBusy(name);
    setNote("");
    try {
      const r = await setLlmActive(name);
      setNote(r.ok ? `已切到「${name}」（${r.model}）` : `切换失败：${r.error}`);
      await load();
    } catch (e) {
      setNote(`切换失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>模型 API</CardTitle>
        <CardDescription>
          密钥存在<strong className="font-medium text-ink">后端</strong>（
          <code className="rounded bg-canvas px-1">llm.local.json</code>），
          这里只切换用哪一档 —— 它永远不进浏览器。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <p className="flex items-start gap-1.5 rounded-md bg-err-600/5 px-3 py-2 text-xs text-err-600">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            读不到配置：{error}（后端没起？）
          </p>
        ) : null}

        {data ? (
          <>
            {data.legacy ? (
              <p className="rounded-md bg-warn-600/10 px-3 py-2 text-xs text-warn-600">
                当前配置是旧版扁平形态（没有 profiles），只能查看、不能在这里增删。
                想用多档案，需要在文件里改成 active + profiles 结构。
              </p>
            ) : null}

            {data.profiles.map((p) => (
              <ProfileRow
                key={p.name}
                profile={p}
                busy={busy === p.name}
                disabled={Boolean(busy) || data.legacy}
                onSwitch={() => void switchTo(p.name)}
              />
            ))}

            {/* 生效值单独列一行：文件和生效值不一致时，这才是真相 */}
            <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-soft">
              当前生效：
              {data.effective.error ? (
                <span className="text-err-600"> {data.effective.error}</span>
              ) : (
                <>
                  <span className="ml-1 font-medium text-navy-900">
                    [{data.effective.profile}] {data.effective.model}
                  </span>
                  <span className="tnum ml-2">
                    max_tokens={data.effective.max_tokens}
                  </span>
                  {data.effective.has_key ? null : (
                    <span className="ml-2 text-err-600">密钥未配置</span>
                  )}
                </>
              )}
              <div className="mt-0.5 truncate text-ink-soft/70">{data.path}</div>
            </div>

            {!data.legacy ? (
              <>
                <Separator />
                <Button
                  variant={adding ? "ghost" : "subtle"}
                  size="sm"
                  onClick={() => {
                    setAdding(!adding);
                    setNote("");
                  }}
                >
                  {adding ? "取消" : (
                    <>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      加一个模型
                    </>
                  )}
                </Button>
                {adding ? (
                  <AddProfileForm
                    onSubmit={(payload) => {
                      setBusy("__add__");
                      void saveLlmProfile(payload)
                        .then(async (r) => {
                          setNote(r.ok ? `已保存「${r.name}」` : `保存失败：${r.error}`);
                          if (r.ok) setAdding(false);
                          await load();
                        })
                        .catch((e) =>
                          setNote(`保存失败：${e instanceof Error ? e.message : String(e)}`),
                        )
                        .finally(() => setBusy(""));
                    }}
                    busy={busy === "__add__"}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : !error ? (
          <p className="flex items-center gap-1.5 text-sm text-ink-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在读取…
          </p>
        ) : null}

        {note ? <p className="text-xs text-ink-soft">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

function ProfileRow({
  profile,
  busy,
  disabled,
  onSwitch,
}: {
  profile: LlmProfile;
  busy: boolean;
  disabled: boolean;
  onSwitch: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2.5",
        profile.active ? "border-navy-900/25 bg-navy-900/[0.03]" : "border-line bg-surface",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-navy-900">{profile.name}</span>
          {profile.active ? (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-ok-600/25 bg-ok-600/10 px-1.5 py-0.5 text-xs text-ok-600">
              <CheckCircle2 className="h-3 w-3" />
              使用中
            </span>
          ) : null}
          {profile.has_key ? null : (
            <span className="rounded-full border border-err-600/25 bg-err-600/10 px-1.5 py-0.5 text-xs text-err-600">
              缺密钥
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{profile.model}</p>
        <p className="truncate text-xs text-ink-soft/70">{profile.base_url}</p>
        {profile.note ? (
          <p className="mt-0.5 text-xs text-ink-soft/70">{profile.note}</p>
        ) : null}
        <p className="tnum mt-0.5 text-xs text-ink-soft/60">
          max_tokens={profile.max_tokens ?? "-"} · temperature={profile.temperature ?? "-"}
          {profile.headers.length ? ` · 额外头 ${profile.headers.length} 个` : ""}
          {profile.headers.length ? "（中转站防 Cloudflare 用）" : ""}
        </p>
      </div>
      {profile.active ? null : (
        <Button size="sm" variant="subtle" disabled={disabled} onClick={onSwitch}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
            <>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              切换
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function AddProfileForm({
  onSubmit,
  busy,
}: {
  onSubmit: (p: {
    name: string;
    provider: string;
    base_url: string;
    model: string;
    api_key: string;
    max_tokens: number;
    temperature: number;
    json_mode: boolean;
  }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState("8192");

  const ready = name.trim() && baseUrl.trim() && model.trim() && apiKey.trim();

  return (
    <div className="anim-rise space-y-2 rounded-md border border-line bg-canvas p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-ink-soft">
          档案名
          <Input
            className="mt-1 h-9"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 ollama"
          />
        </label>
        <label className="text-xs text-ink-soft">
          模型名
          <Input
            className="mt-1 h-9"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如 qwen2.5:7b"
          />
        </label>
      </div>
      <label className="block text-xs text-ink-soft">
        base_url
        <Input
          className="mt-1 h-9"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:11434/v1"
        />
      </label>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-ink-soft">
          API 密钥
          <Input
            className="mt-1 h-9"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="本地 Ollama 随便填个非空值"
          />
        </label>
        <label className="text-xs text-ink-soft">
          max_tokens
          <Input
            className="mt-1 h-9"
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-ink-soft/70">
        密钥会直接写进后端的 llm.local.json（该文件已在 .gitignore 里）。
        本地 Ollama 不校验密钥，但必须填个非空值 —— 后端靠它判断「配置好了没」。
      </p>
      <Button
        size="sm"
        disabled={!ready || busy}
        onClick={() =>
          onSubmit({
            name: name.trim(),
            provider: "custom",
            base_url: baseUrl.trim(),
            model: model.trim(),
            api_key: apiKey.trim(),
            max_tokens: Number(maxTokens) || 8192,
            temperature: 0,
            json_mode: true,
          })
        }
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "保存"}
      </Button>
    </div>
  );
}
