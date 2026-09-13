import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import { ROLE_LABEL, type Role } from "@/lib/types";

/** 测试账号：不发真邮件，点一下就进（对应架构文档 Q10） */
const ACCOUNTS: { name: string; role: Role; grade: string; subjects: string[] }[] = [
  { name: "小明", role: "student", grade: "高二", subjects: ["数学"] },
  { name: "李家长", role: "parent", grade: "高二", subjects: ["数学"] },
  { name: "王老师", role: "teacher", grade: "高二", subjects: ["数学", "物理"] },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-serif-cn text-lg font-semibold text-navy-900">智绘课堂</span>
        </Link>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <h1 className="font-serif-cn text-xl font-semibold">选择测试账号</h1>
            <Badge tone="warn">演示环境</Badge>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">
            不发真邮件、不校验密码。角色只影响默认打开的面板和措辞，功能完全一致。
          </p>

          <ul className="space-y-2">
            {ACCOUNTS.map((a) => (
              <li key={a.name}>
                <Button variant="outline" className="h-auto w-full justify-between px-4 py-3" asChild>
                  <Link href="/app">
                    <span className="text-left">
                      <span className="block text-sm font-medium">{a.name}</span>
                      <span className="block text-xs text-ink-soft">
                        {ROLE_LABEL[a.role]} · {a.grade} · {a.subjects.join("、")}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-soft" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-4 text-center text-xs text-ink-soft">
          <Link href="/" className="underline-offset-2 hover:underline">
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
