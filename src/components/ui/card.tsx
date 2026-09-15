import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 卡片。
 *
 * 层次由**描边 + 两级投影**建立，而不是靠加深底色 —— 加深底色会连同层次一起变浑。
 * `elevation` 三档对应三种存在感：
 *   card（默认）静止的卡片内容
 *   raised      可点、会浮起的卡片（悬停升到二级投影）
 *   glass       铺在图片/光晕之上的浮层（顶栏、吸顶条）
 * 另外 `flat` 给"不要投影、只用作分区"的场景（表单区块、内嵌面板）。
 */
type Elevation = "flat" | "card" | "raised" | "glass";

const ELEVATION: Record<Elevation, string> = {
  flat: "border border-border bg-surface",
  card: "border border-border bg-surface shadow-card",
  raised: "t-lift border border-border bg-surface shadow-card",
  glass: "t-glass shadow-raised",
};

function Card({
  className,
  elevation = "card",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevation?: Elevation }) {
  return (
    <div
      className={cn("rounded-card", ELEVATION[elevation], className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4", className)} {...props} />;
}

/**
 * 卡片标题走**功能级**字体（无衬线）。
 * 展示级衬线只留给 Hero、空态问候语与章节标题 —— 卡片标题出现在高频操作路径上，
 * 衬线体的笔锋与字面差异会拖慢识别。
 */
function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <h3
      className={cn("font-heading text-base font-semibold text-fg", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-border p-4", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
