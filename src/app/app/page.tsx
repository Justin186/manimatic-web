import { Workbench } from "@/components/workbench/Workbench";

/**
 * 创作台入口 = **新会话的草稿界面**。
 *
 * 它本身不是一个会话：不生成 id、不写任何记录，URL 就停在 `/app`。
 * 用户在这里发出的**第一条消息**才会真的创建会话 —— 那时 Workbench 自己会
 * 生成 id、把它登记进侧栏，并把 URL 换成 `/app/t/<id>`。
 *
 * 为什么不在这里"先建一个空会话再跳走"：那样侧栏会立刻多出一条「新的讲解」，
 * 而用户可能只是点了一下就切走 —— 空会话会一条条攒下来。
 * 草稿模式让"没说过话的会话"压根不存在，也就无所谓要不要清理它。
 */
export default function AppIndex() {
  return <Workbench />;
}
