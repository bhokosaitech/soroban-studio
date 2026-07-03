"use client";

import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

type IconMap = Record<string, React.ComponentType<LucideProps>>;

/**
 * Resolve a lucide icon by the string name stored in the block catalog.
 * Falls back to a neutral square so an unknown name never crashes a node.
 */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (Lucide as unknown as IconMap)[name] ?? Lucide.Square;
  return <Cmp {...props} />;
}
