import * as React from "react";
import { cn } from "@/lib/utils";

/** Plain table primitives. Scrolling is owned by the parent container (see DataTable). */
export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <table className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)} {...p} />
);
export const TableHeader = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn("sticky top-0 z-20", className)} {...p} />;
export const TableBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TableRow = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("group/row transition-colors", className)} {...p} />
);
export const TableHead = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("h-10 whitespace-nowrap border-b border-border bg-surface-muted px-3 text-left align-middle text-xs font-medium uppercase tracking-[0.04em] text-text-muted", className)} {...p} />
);
export const TableCell = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("whitespace-nowrap border-b border-border bg-surface px-3 align-middle text-sm text-text transition-colors group-hover/row:bg-surface-muted", className)} {...p} />
);
