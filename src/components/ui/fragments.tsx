"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 border-b border-line", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px border-b-2 border-transparent px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-navy-900 data-[state=active]:border-brick-600 data-[state=active]:text-navy-900",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-3 focus:outline-none", className)}
      {...props}
    />
  );
}

function Avatar({
  className,
  fallback,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { fallback?: React.ReactNode }) {
  return (
    <AvatarPrimitive.Root
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-900 text-xs font-medium text-white", className)}
      {...props}
    >
      <AvatarPrimitive.Fallback>{fallback ?? "?"}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, Avatar };
