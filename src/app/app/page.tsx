import { redirect } from "next/navigation";

/** 创作台入口：重定向到最近一次会话 */
export default function AppIndex() {
  redirect("/app/t/demo");
}
