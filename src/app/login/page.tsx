import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/fragments";
import { Badge } from "@/components/ui/primitives";
import { ROLE_LABEL, type Role } from "@/lib/types";

/**
 * 测试账号：不发真邮件，点一下就进（对应架构文档 Q10）。
 *
 * ⚠️ 科目刻意不是清一色数学：产品做的是**任意学科**的知识讲解，
 * 演示数据全写"数学"会把这个印象说死。
 */
const ACCOUNTS: { name: string; role: Role; grade: string; subjects: string[] }[] = [
  { name: "小明", role: "student", grade: "高二", subjects: ["数学", "物理"] },
  { name: "李家长", role: "parent", grade: "高二", subjects: ["数学", "物理"] },
  { name: "王老师", role: "teacher", grade: "高二", subjects: ["数学", "物理", "化学"] },
];

export default function LoginPage() {
  return (
    /*
      容器用全站统一的 .page-shell（左右内边距一致），
      但**卡片本身刻意比内容页窄**：登录是一件事一件事地做，
      把卡片拉到 1100px 只会让三行账号之间空出半屏。
    */
    <div className="page-shell grid min-h-dvh place-items-center bg-bg py-10">
      <div className="w-full max-w-xl">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="t-grad grid h-8 w-8 place-items-center rounded-control text-accent-fg">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold text-fg">智绘课堂</span>
        </Link>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-fg">选择测试账号</h1>
            <Badge tone="warn">演示环境</Badge>
          </div>
          <p className="mt-2 mb-5 text-sm leading-relaxed text-fg-muted">
            不发真邮件、不校验密码。角色只影响默认打开的面板和措辞，功能完全一致。
          </p>

          <ul className="space-y-2">
            {ACCOUNTS.map((a) => (
              <li key={a.name}>
                {/*
                  整行可点，走 t-lift（悬停抬升 + 投影升级），而不是给 Button 加 asChild：
                  登录页的选项是"卡片式选择"，形态上更接近列表项，不是操作按钮。
                */}
                <Link
                  href="/app"
                  className="t-lift flex items-center gap-3 rounded-inner border border-border bg-surface px-4 py-3 shadow-card hover:border-accent/40"
                >
                  <Avatar fallback={a.name.slice(0, 1)} className="h-9 w-9 text-sm" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium text-fg">{a.name}</span>
                    <span className="block truncate text-xs text-fg-muted">
                      {ROLE_LABEL[a.role]} · {a.grade} · {a.subjects.join("、")}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          <Link href="/" className="underline-offset-2 hover:text-fg hover:underline">
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
