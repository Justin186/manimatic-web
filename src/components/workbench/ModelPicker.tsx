"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu, Loader2 } from "lucide-react";

import { fetchLlmProfiles, setLlmActive, USE_MOCK } from "@/lib/api";
import type { LlmProfile, LlmProfilesResponse } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** 切换失败提示在工具条里停留多久（毫秒）：够看清，又不至于一直占着位置 */
const ERROR_TTL = 6000;

/**
 * 输入框左下角的模型切换。
 *
 * 四件事与设置页（`ModelSettings.tsx`）保持同一套口径，别在这里另立一套：
 *
 * 1. **模型是后端的全局设置，不是这条会话的属性**。切一下就是改
 *    `llm.local.json` 的 `active`（`POST /api/llm/active`），所有会话一起变 ——
 *    这是后端契约定的：`/api/chat` 压根不接模型参数（见 `api/routes/chat.py`
 *    的 `LLM_PROFILE`）。所以界面上不写"本会话模型"，免得让人以为只影响当前这条对话。
 * 2. **生效值优先于文件里写的值**。`/api/llm/profiles` 同时回 `profiles[].active`
 *    与 `effective.profile`，后者才是真正在跑的那一档（两者不一致时最容易骗人）。
 * 3. **密钥不进浏览器**。这里拿不到、也不显示密钥；缺密钥只标一个"缺密钥"角标，
 *    真正的失败由后端在调用时报出来。
 * 4. **Mock 模式显示"未接入模型"**。对着一个假后端摆一排能点的模型名，
 *    用户点完发现什么都没变 —— 那比明说"没接"更糟（同 `ModelSettings` 的取舍）。
 *
 * 为什么禁用条件里有 `busy`：`/api/chat` 是在**发起那一刻**读配置的，
 * 生成到一半换档，这一轮的答案仍然是上一个模型给的，而工具条已经显示新模型了。
 * 这正是本项目最忌讳的"看起来切了、其实没切"。生成完再换即可。
 */
export function ModelPicker({ disabled }: { disabled?: boolean }) {
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [active, setActive] = useState("");
  const [legacy, setLegacy] = useState(false);
  /** 读配置失败（后端没起 / 配置坏了）：这时的"选不了"要说出来，不能装作没事 */
  const [loadError, setLoadError] = useState("");
  /** 切换失败：短暂显示后自动消失（见 ERROR_TTL） */
  const [switchError, setSwitchError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [switching, setSwitching] = useState(false);
  const timer = useRef<number | null>(null);

  const apply = useCallback((d: LlmProfilesResponse) => {
    setProfiles(d.profiles ?? []);
    setActive(d.effective?.profile || d.active || "");
    setLegacy(Boolean(d.legacy));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (USE_MOCK) return;
    let alive = true;
    // 刻意不写成 effect 体内直接 await + setState：那会被 lint 判为"同步更新"。
    // 走 promise 回调既避开这点，也顺手拿到"组件已卸载就别再 set"的保护。
    void fetchLlmProfiles().then(
      (d) => {
        if (!alive) return;
        apply(d);
        setLoadError("");
      },
      (e: unknown) => {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoaded(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [apply]);

  // 组件卸载时把自动清除的定时器收掉：切页时正巧有提示在飘，不该留个野定时器
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function flash(message: string) {
    setSwitchError(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSwitchError(""), ERROR_TTL);
  }

  async function switchTo(name: string) {
    if (name === active || switching) return;
    setSwitching(true);
    setSwitchError("");
    try {
      const r = await setLlmActive(name);
      if (!r.ok) throw new Error(r.error || "切换失败");
      // 切完重新读一遍而不是本地改标记：后端会回读校验，以它读回来的为准
      apply(await fetchLlmProfiles());
    } catch (e) {
      // 失败必须说出来。悄悄不动的话用户以为换成了新模型，后面几轮其实还是老模型在答
      flash(e instanceof Error ? e.message : String(e));
    } finally {
      setSwitching(false);
    }
  }

  /**
   * Mock 模式：一个字的假配置都不显示。
   *
   * ⚠️ 这个提前 return 必须在**所有 hook 之后**（它下面的 useCallback/useEffect 已经
   * 全部调用完了，所以顺序是稳定的）。放到 hook 前面就会违反 hooks 规则。
   */
  if (USE_MOCK) {
    return (
      <span
        className="shrink-0 px-1.5 text-xs text-ink-soft/60"
        title="Mock 模式没有真实模型 —— 请求打的是前端自带的假后端，切模型没有任何意义"
      >
        未接入模型
      </span>
    );
  }

  const loading = !loaded;
  const current = profiles.find((p) => p.name === active) ?? profiles[0];
  const canOpen = !disabled && !loading && !loadError && !legacy && profiles.length > 1;

  const label = loadError
    ? "读不到模型"
    : loading
      ? "模型"
      : current?.model || active || "未配置";

  const title = loadError
    ? `读不到模型配置：${loadError}（后端没起？）`
    : legacy
      ? "当前是旧版扁平配置（没有 profiles），只能在设置页看，不能在这里切"
      : profiles.length === 0
        ? "还没有配置任何模型档案，去设置页加一个"
        : profiles.length === 1
          ? `档案 ${current?.name} · ${current?.model} —— 只配了这一档，没有别的可切`
          : disabled
            ? "生成中不能换模型：这一轮的答案已经用切换前的模型在生成了"
            : `档案 ${current?.name} · ${current?.model}（后端全局设置，点这里换）`;

  return (
    /*
     * 外层 `flex-1 min-w-0` 不是装饰：工具条是 `justify-between`，左边这一格必须能
     * **被压缩**，否则那条出错提示（"写入失败：...llm.local.json"，可能很长）会把
     * 发送按钮顶出卡片外面。有了 min-w-0，它自己截断，布局不会被一段报错撑坏。
     */
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!canOpen}
            title={title}
            aria-label="选择模型"
            className={cn(
              // 左移 4px，抵掉胶囊自带的 `px-1.5` 里的大部分：
              // 不抵的话图标比上面的占位文字右偏 6px（用户圈过这个"没对齐"）；
              // 但**不能全抵**（`-ml-1.5`）—— 汉字字形左边留白 1~2px，全抵后
              // 图标反而看着比文字偏左。留 2px 才是**视觉上**对齐。
              "flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs transition-colors",
              "-ml-1",
              canOpen
                ? "text-ink-soft hover:bg-canvas hover:text-navy-900"
                : "cursor-default text-ink-soft/60",
              loadError && "text-err-600",
            )}
          >
            {switching || loading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Cpu className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="max-w-[9rem] truncate">{label}</span>
            {canOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>用哪个模型（后端全局设置，影响所有会话）</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.map((p) => (
            <DropdownMenuItem
              key={p.name}
              // 当前这一档不给点：点了也只是把同一个名字再写一遍
              disabled={p.active || switching}
              onSelect={() => void switchTo(p.name)}
              className="items-start"
            >
              <span className="mt-0.5 w-3.5 shrink-0">
                {p.active ? <Check className="h-3.5 w-3.5 text-ok-600" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm text-navy-900">{p.model || p.name}</span>
                  {p.has_key ? null : (
                    <span className="shrink-0 text-xs text-err-600">缺密钥</span>
                  )}
                </span>
                {/* 档案名 + 地址：模型名可能重名（比如两档都是 deepseek-chat），
                    真正的区分点是档案名，所以它必须出现在列表里 */}
                <span className="block truncate text-xs text-ink-soft/80">
                  {p.name}
                  {p.base_url ? ` · ${p.base_url}` : ""}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {switchError ? (
        <span className="min-w-0 truncate text-xs text-err-600" title={switchError}>
          切换失败：{switchError}
        </span>
      ) : null}
    </div>
  );
}
