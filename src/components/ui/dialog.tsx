"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("anim-overlay fixed inset-0 z-50 bg-navy-950/45", className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "anim-dialog fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface p-5 shadow-xl focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded p-1 text-ink-soft transition-colors hover:bg-canvas hover:text-navy-900">
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex flex-col gap-1", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-serif-cn text-lg font-semibold text-navy-900", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-ink-soft", className)} {...props} />;
}

/* ---------------- Sheet：移动端抽屉，左右两方向即可 ---------------- */

function SheetContent({
  side = "left",
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[82%] max-w-[22rem] flex-col bg-surface shadow-xl focus:outline-none",
          side === "left"
            ? "anim-sheet-left left-0 border-r border-line"
            : "anim-sheet-right right-0 border-l border-line",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded p-1 text-ink-soft transition-colors hover:bg-canvas hover:text-navy-900">
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  SheetContent,
};
