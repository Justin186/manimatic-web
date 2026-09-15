"use client";

import Link from "next/link";
import { Check, Monitor, Moon, Sparkles, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEGMENTED_GROUP, SegmentedControl, segmentItemClass } from "@/components/ui/segmented";
import { ModelSettings } from "@/components/workbench/ModelSettings";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { ROLE_LABEL, STYLE_OPTIONS, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["student", "parent", "teacher"];
const GRADES = ["初中", "高一", "高二", "高三", "大学"];

/**
 * 科目。
 *
 * ⚠️ 刻意不只有理科：产品做的是**任意学科**的知识讲解，
 * 只列数学/物理/化学会把"这是个理科工具"说死。
 */
const SUBJECTS = ["数学", "物理", "化学", "生物", "语文", "英语"];

export default function SettingsPage() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const style = useStore((s) => s.style);
  const setStyle = useStore((s) => s.setStyle);
  const { theme, setTheme } = useTheme();

  const toggleSubject = (s: string) => {
    const has = profile.subjects.includes(s);
    const next = has ? profile.subjects.filter((x) => x !== s) : [...profile.subjects, s];
    // 至少保留一个：全清空之后 AI 就没有学科上下文了（后端会当成"未指定"）
    setProfile({ ...profile, subjects: next.length ? next : profile.subjects });
  };

  return (
    /*
      容器走全站统一的 `.page-shell`（就是样片页那套 max-w-6xl + px-5）。
      分组排布走 `.card-grid`：列宽是**比例**而不是像素，
      所以窗口变宽时是"卡片跟着变宽"，而不是"右边多出一大片空白"。

      ⚠️ 分组的容器宽度由这一个类决定，页面里不要再写 `max-w-*` ——
      每页各写一套，就是"设置页比样片窄"这类问题的来源。
    */
    <div className="page-shell min-h-dvh py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="t-grad grid h-8 w-8 place-items-center rounded-control text-accent-fg">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-display text-base font-semibold text-fg">智绘课堂</span>
      </Link>

      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">画像与偏好</h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        注册时问 3 项（身份 / 学段 / 科目），风格与时长用默认值；这里改过就会被记住。
      </p>

      {/*
        原先这 5 组挤在一张 `max-w-2xl` 的大卡里、靠分隔线切开。
        宽屏上就是一条又窄又长的竖条：左边一列字，右边整片空。
        拆成独立卡片交给 `.card-grid` 后，宽度一变就自动多排一列，
        卡片本身始终是接近方形的比例。
      */}
      <div className="card-grid mt-6">
        <Card>
          <CardHeader>
            <CardTitle>身份</CardTitle>
            <CardDescription>只影响默认打开的面板与措辞，不影响可用的功能</CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentedControl<Role>
              label="身份"
              value={profile.role}
              onChange={(r) => setProfile({ ...profile, role: r })}
              items={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>学段</CardTitle>
            <CardDescription>决定讲解的深度与用词</CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentedControl
              label="学段"
              size="sm"
              value={profile.grade}
              onChange={(g) => setProfile({ ...profile, grade: g })}
              items={GRADES.map((g) => ({ value: g, label: g }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>科目</CardTitle>
            <CardDescription>可多选，至少保留一个</CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              ⚠️ 这里是**多选**，所以没用 SegmentedControl（它只做单选）：
              把多选塞进单选控件，用户看到"选了一个另一个就灭了"只会以为是 bug。
              但外观复用同一套样式常量，两组的观感是一致的。
            */}
            <div className={SEGMENTED_GROUP} role="group" aria-label="科目">
              {SUBJECTS.map((s) => {
                const on = profile.subjects.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSubject(s)}
                    className={cn(segmentItemClass(on, "sm"), on && "bg-accent-soft text-accent")}
                  >
                    {on ? <Check className="mr-1 inline h-3 w-3" /> : null}
                    {s}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>讲解风格</CardTitle>
            <CardDescription>影响 AI 讲解的措辞与详略。工作台里不再放切换条，统一在这里改</CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentedControl
              label="讲解风格"
              value={style}
              onChange={setStyle}
              items={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label, title: s.hint }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>外观</CardTitle>
            <CardDescription>默认亮色。选择会被记住，下次打开不会先闪一下白屏</CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              ⚠️ 首帧这块显示的是"亮色"（服务端快照），hydration 之后才会跳到真实值。
                 这是 `useLocalStorage` 的 `getServerSnapshot` 设计使然 ——
                 换来的是"不会 hydration 不匹配"，代价是暗色用户看到一个瞬间的高亮偏移。
                 页面本身的配色不会错（防白闪脚本在样式生效前就写好了 class），
                 只有这个小控件的位置偏一帧。
            */}
            <SegmentedControl<"light" | "dark">
              label="外观"
              value={theme}
              onChange={setTheme}
              items={[
                {
                  value: "light",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5" />
                      亮色
                    </span>
                  ),
                },
                {
                  value: "dark",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Moon className="h-3.5 w-3.5" />
                      暗色
                    </span>
                  ),
                },
              ]}
            />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
              <Monitor className="h-3.5 w-3.5" />
              当前不跟随系统主题 —— 首屏按上次的选择渲染，避免「先亮后暗」地闪一下。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 模型 API：切换 / 新增模型档案。密钥只留在服务端，这里只传"用哪一档"。 */}
      <ModelSettings />

      <div className="mt-6 flex items-center gap-2">
        <Button asChild>
          <Link href="/app">返回创作台</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/pricing">查看配额</Link>
        </Button>
      </div>
    </div>
  );
}
