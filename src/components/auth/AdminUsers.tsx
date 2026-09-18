"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Plus, ShieldCheck, Trash2, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import {
  createUser,
  deleteUser,
  displayName,
  fetchMe,
  fetchUsers,
  patchUser,
  type AdminUser,
  type AuthUser,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * 设置页里的「账号管理」面板。**只有管理员看得见**。
 *
 * ============================================================================
 * 三条设计取舍
 * ============================================================================
 * 1. **不提供注册开关**。注册开不开由部署时的 `MSB_AUTH_INVITE` 决定（一个环境
 *    变量）。做成网页开关意味着"任何拿到管理面板的人都能把站门打开"，
 *    而这条通道的开关本就该在部署者手里。
 *
 * 2. **危险动作一律二次确认**（停用 / 重置密码 / 删除）。尤其是重置密码 ——
 *    它会**立刻把对方踢下线**，而管理员看不到对方的会话状态，
 *    不确认的话很容易以为"只是改个密码"。
 *
 * 3. **删号时明确告诉管理员"数据不会被删"**。这不是免责声明，是实情：
 *    视频渲一遍要几分钟，账号可以重建，数据比账号值钱（见后端 admin.py）。
 */
export function AdminUsers({ bare = false }: { bare?: boolean }) {
  const toast = useToast();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** 正在编辑的目标：null = 没开；"new" = 建号；数字 = 改那个 id */
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchMe().then((u) => {
      if (!alive) return;
      setMe(u);
      // ⚠️ 先确认身份再拉列表：非管理员拉会吃 403，而那条 403 会被
      //    显示成一个红色的"加载失败"，看起来像功能坏了。
      if (u?.isAdmin) void reload();
      else setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  if (!me?.isAdmin) return null;

  const target = typeof editing === "number" ? users.find((u) => u.id === editing) : null;

  /**
   * 内容抽出来是为了能放两个地方：设置页里的卡片（`bare=false`），
   * 以及顶栏头像菜单里的弹窗（`bare=true`，此时不要再套一层卡片）。
   *
   * ⚠️ 抽的是**内容**不是 Card 本身 —— 套着卡片塞进弹窗会出现"卡中卡"，
   *    两层边框两套内边距，看着像没做完。
   */
  const body = (
    <>
      {loading ? (
          <p className="text-sm text-fg-subtle">加载中…</p>
        ) : error ? (
          <p className="rounded-inner bg-err-soft px-3 py-2 text-xs leading-relaxed text-err">
            {error}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-fg">
                      {displayName(u)}
                    </span>
                    {u.isRoot && <Badge tone="warn">超级管理员</Badge>}
                    {!u.isRoot && u.isAdmin && <Badge tone="accent">管理员</Badge>}
                    {u.status !== "active" && <Badge tone="neutral">已停用</Badge>}
                    {u.id === me.id && <Badge tone="neutral">你</Badge>}
                  </span>
                  <span className="block truncate text-xs text-fg-subtle">{u.email}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(u.id)}>
                  编辑
                </Button>
              </li>
            ))}
          </ul>
        )}
    </>
  );

  const addButton = (
    <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
      <Plus className="h-3.5 w-3.5" />
      建号
    </Button>
  );

  return (
    <>
      {bare ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-fg-muted">
              注册开关由部署时的环境变量
              <code className="mx-1 rounded bg-surface-2 px-1">MSB_AUTH_INVITE</code>
              决定，这里不提供。
            </p>
            {addButton}
          </div>
          {body}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>账号管理</CardTitle>
                <CardDescription>
                  建号 / 停用 / 重置密码 / 提降权 / 删号。注册开关由部署时的环境变量
                  <code className="mx-1 rounded bg-surface-2 px-1 text-xs">
                    MSB_AUTH_INVITE
                  </code>
                  决定，这里不提供。
                </CardDescription>
              </div>
              {addButton}
            </div>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "新建账号" : `编辑 ${displayName(target)}`}</DialogTitle>
          </DialogHeader>
          {editing === "new" ? (
            <NewUserForm
              busy={busy}
              onSubmit={async (req) => {
                setBusy(true);
                try {
                  await createUser(req);
                  toast(`已建号：${req.email}`);
                  setEditing(null);
                  await reload();
                } catch (err) {
                  toast(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : target ? (
            <EditUserForm
              user={target}
              me={me}
              busy={busy}
              onSubmit={async (patch, confirmText) => {
                // ⚠️ 二次确认不是形式：重置密码会把对方**立刻踢下线**，
                //    而管理员在界面上看不到对方的会话状态。
                if (confirmText && !window.confirm(confirmText)) return;
                setBusy(true);
                try {
                  const r = await patchUser(target.id, patch);
                  toast(
                    r.revoked
                      ? `已重置密码，并让对方的 ${r.revoked} 个登录态失效（会被踢下线）`
                      : "已保存",
                  );
                  setEditing(null);
                  await reload();
                } catch (err) {
                  toast(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
              onDelete={async () => {
                if (!window.confirm(
                  `删除 ${target.email}？\n\n他的会话与视频**不会被删除**（数据比账号值钱）。` +
                  `\n这个账号将无法再登录。`)) return;
                setBusy(true);
                try {
                  await deleteUser(target.id);
                  toast(`已删除 ${target.email}`);
                  setEditing(null);
                  await reload();
                } catch (err) {
                  toast(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewUserForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (req: { email: string; password: string; name?: string; role: "user" | "admin" }) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ email, password, name, role });
      }}
    >
      <Input placeholder="邮箱" type="email" required value={email}
             onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="显示名（可选）" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="初始密码" type="password" required value={password}
             onChange={(e) => setPassword(e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-fg-muted">
        <input type="checkbox" checked={role === "admin"}
               onChange={(e) => setRole(e.target.checked ? "admin" : "user")} />
        <ShieldCheck className="h-3.5 w-3.5" />
        给管理员权限
      </label>
      <Button type="submit" className="w-full" disabled={busy}>
        <Check className="h-4 w-4" />
        创建
      </Button>
    </form>
  );
}

function EditUserForm({
  user,
  me,
  busy,
  onSubmit,
  onDelete,
}: {
  user: AdminUser;
  me: AuthUser;
  busy: boolean;
  onSubmit: (patch: { role?: "user" | "admin"; status?: "active" | "disabled"; password?: string }, confirmText?: string) => void;
  onDelete: () => void;
}) {
  const [password, setPassword] = useState("");
  const locked = user.isRoot || user.id === me.id;

  return (
    <div className="space-y-3">
      {locked && (
        <p className="rounded-inner bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
          {user.isRoot
            ? "超级管理员是最后的退路，不能被停用 / 降级 / 删除。"
            : "这是你自己的账号 —— 改自己的角色或停用自己会把自己锁在门外，所以这里只允许改密码。"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || locked}
          onClick={() => onSubmit({ role: user.isAdmin ? "user" : "admin" })}
        >
          {user.isAdmin ? "降为普通用户" : "提为管理员"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || locked}
          onClick={() =>
            onSubmit(
              { status: user.status === "active" ? "disabled" : "active" },
              user.status === "active" ? `停用 ${user.email}？他会被立刻踢下线。` : undefined,
            )
          }
        >
          <UserX className="h-3.5 w-3.5" />
          {user.status === "active" ? "停用" : "启用"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="password"
          placeholder="新密码（留空 = 不改）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          size="sm"
          disabled={busy || !password}
          onClick={() =>
            onSubmit(
              { password },
              `给 ${user.email} 重置密码？\n\n对方的全部登录态会**立刻失效**（被踢下线）。`,
            )
          }
        >
          <KeyRound className="h-3.5 w-3.5" />
          重置
        </Button>
      </div>

      <div className={cn("border-t border-border pt-3")}>
        <Button size="sm" variant="ghost" disabled={busy || locked} onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          删除账号
        </Button>
      </div>
    </div>
  );
}
