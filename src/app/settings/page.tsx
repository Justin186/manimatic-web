"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, STYLE_OPTIONS, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModelSettings } from "@/components/workbench/ModelSettings";

const ROLES: Role[] = ["student", "parent", "teacher"];
const GRADES = ["初中", "高一", "高二", "高三", "大学"];
const SUBJECTS = ["数学", "物理", "化学"];

export default function SettingsPage() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const style = useStore((s) => s.style);
  const setStyle = useStore((s) => s.setStyle);

  const toggleSubject = (s: string) => {
    const has = profile.subjects.includes(s);
    const next = has ? profile.subjects.filter((x) => x !== s) : [...profile.subjects, s];
    setProfile({ ...profile, subjects: next.length ? next : profile.subjects });
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-serif-cn text-base font-semibold text-navy-900">智绘课堂</span>
      </Link>

      <h1 className="font-serif-cn text-2xl text-navy-900">画像与偏好</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        注册时问 3 项（身份 / 学段 / 科目），风格与时长用默认值；这里改过就会被记住。
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>身份</CardTitle>
          <CardDescription>只影响默认打开的面板与措辞，不影响可用的功能</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setProfile({ ...profile, role: r })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                profile.role === r
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line bg-surface text-ink hover:bg-canvas",
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </CardContent>
        <Separator />
        <CardHeader>
          <CardTitle>学段</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setProfile({ ...profile, grade: g })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                profile.grade === g
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line bg-surface text-ink hover:bg-canvas",
              )}
            >
              {g}
            </button>
          ))}
        </CardContent>
        <Separator />
        <CardHeader>
          <CardTitle>科目</CardTitle>
          <CardDescription>可多选，至少保留一个</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSubject(s)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                profile.subjects.includes(s)
                  ? "border-brick-600 bg-brick-100 text-brick-700"
                  : "border-line bg-surface text-ink hover:bg-canvas",
              )}
            >
              {s}
            </button>
          ))}
        </CardContent>
        <Separator />
        <CardHeader>
          <CardTitle>讲解风格</CardTitle>
          <CardDescription>
            影响 AI 讲解的措辞与详略。工作台里不再放切换条，统一在这里改
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              title={s.hint}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                style === s.value
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line bg-surface text-ink hover:bg-canvas",
              )}
            >
              {s.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* 模型 API：切换 / 新增模型档案。密钥始终留在后端，这里只传"用哪一档"。 */}
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
