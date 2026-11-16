import { useEffect, useMemo, useState } from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type RowData, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Rows3, Rows4, Search, SearchX, X } from "lucide-react";
import { usePrefs } from "@/app/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsSmall } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> { align?: "right"; className?: string }
}

export interface TableFilter { single?: boolean; id: string; label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }

interface Props<T> {
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[] | undefined;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  searchPlaceholder?: string;
  /** controlled search (server-side); otherwise the table filters the loaded rows */
  search?: { value: string; onChange: (v: string) => void };
  hideToolbar?: boolean;
  filters?: TableFilter[];
  onReset?: () => void;
  toolbarExtra?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  empty?: { title: string; message?: string };
  pageSize?: number;
  pageSizeOptions?: number[];
  /** server-side pagination: `data` is the current page only */
  server?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange?: (n: number) => void };
  /** full-page list: the card fills its parent and only the table body scrolls */
  fill?: boolean;
  /** keep the pager clear of the floating assistant button (tables that sit at the bottom-right of the screen) */
  pagerInset?: boolean;
  /** show every passed row without a pager (dashboard cards that pre-limit their data) */
  noPagination?: boolean;
  className?: string;
  /** compact list item shown below 640px (primary ID, badge, two key fields, chevron) */
  renderMobile?: (row: T) => React.ReactNode;
}

/** Text that truncates with a tooltip carrying the full value. */
export function Truncate({ children, className }: { children: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className={cn("block max-w-[28ch] truncate", className)}>{children}</span></TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const lo = Math.max(2, page - 1), hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push("…");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

function FacetFilter({ f }: { f: TableFilter }) {
  const n = f.value.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0" aria-label={`Filter by ${f.label}`}>
          {f.label}
          {n > 0 && <span className="rounded-full bg-primary-soft px-1.5 text-xs font-medium tabular-nums text-primary">{n}</span>}
          <ChevronDown className="text-text-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{f.label}</DropdownMenuLabel>
        {f.options.map((o) => (
          <DropdownMenuCheckboxItem key={o.value} checked={f.value.includes(o.value)} onSelect={(e) => e.preventDefault()}
            onCheckedChange={(c) => f.onChange(c ? (f.single ? [o.value] : [...f.value, o.value]) : f.value.filter((v) => v !== o.value))}>{o.label}</DropdownMenuCheckboxItem>
        ))}
        {n > 0 && <><DropdownMenuSeparator /><button type="button" className="h-8 w-full rounded-lg px-2.5 text-left text-xs font-medium text-primary hover:bg-surface-muted" onClick={() => f.onChange([])}>Clear selection</button></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One shared table: toolbar, sticky header, internal scroll, attached pagination, mobile list mode and states. */
export function DataTable<T>({
  columns, data, loading, error, onRetry, searchPlaceholder = "Search…", search, hideToolbar, filters = [], onReset, toolbarExtra, onRowClick, rowLabel,
  empty, pageSize = 10, pageSizeOptions = [10, 20, 50], server, fill, pagerInset = fill, noPagination, className, renderMobile,
}: Props<T>) {
  const small = useIsSmall();
  const { density, setDensity } = usePrefs();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [local, setLocal] = useState("");
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [size, setSize] = useState(server?.pageSize ?? pageSize);
  const rows = useMemo(() => data ?? [], [data]);
  const query = search ? search.value : local;
  const setQuery = search ? search.onChange : setLocal;
  const compact = density === "compact";

  const table = useReactTable({
    data: rows, columns, state: { sorting, globalFilter: server ? "" : query, columnVisibility: visibility },
    onSortingChange: setSorting, onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    ...(server ? { manualPagination: true } : noPagination ? { getFilteredRowModel: getFilteredRowModel() } : { getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel() }),
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize } },
  });
  useEffect(() => { if (!server) table.setPageSize(size); }, [size, server, table]);

  const total = server ? server.total : table.getFilteredRowModel().rows.length;
  const perPage = server ? server.pageSize : size;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(server ? server.page : table.getState().pagination.pageIndex + 1, pages);
  const goto = (p: number) => (server ? server.onPageChange(p) : table.setPageIndex(p - 1));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const setPerPage = (n: number) => { if (server) { server.onPageSizeChange?.(n); server.onPageChange(1); } else setSize(n); };

  const filtersActive = query.length > 0 || filters.some((f) => f.value.length > 0);
  const reset = () => { setQuery(""); onReset?.(); };
  const visibleRows = table.getRowModel().rows;
  const colCount = table.getVisibleLeafColumns().length;
  const showPager = !noPagination && !error && !loading && total > 0;
  const rowH = compact ? "h-10" : "h-12";

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs", fill && "h-full flex-1", className)}>
      {!hideToolbar && (
        <div className="flex min-h-[52px] shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-thin">
            <div className="relative w-full max-w-[280px] min-w-[140px] shrink">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <Input aria-label="Search table" placeholder={searchPlaceholder} className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {filters.map((f) => <FacetFilter key={f.id} f={f} />)}
            {filtersActive && <Button variant="ghost" size="sm" className="shrink-0" onClick={reset}><X /> Reset</Button>}
            {toolbarExtra}
          </div>
          {!small && (
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={compact ? "Switch to comfortable density" : "Switch to compact density"} aria-pressed={compact} onClick={() => setDensity(compact ? "comfortable" : "compact")}>
                    {compact ? <Rows4 /> : <Rows3 />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{compact ? "Comfortable rows" : "Compact rows"}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Column visibility"><Columns3 /></Button></DropdownMenuTrigger></TooltipTrigger>
                  <TooltipContent>Columns</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Columns</DropdownMenuLabel>
                  {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                      {String(typeof c.columnDef.header === "string" ? c.columnDef.header : c.id).replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}

      <div className={cn("min-h-0 overflow-auto scrollbar-thin", fill ? "flex-1" : "flex-1 max-h-[320px] sm:max-h-[360px]")} data-testid="table-scroll">
        {error ? <ErrorState onRetry={onRetry} /> : small && renderMobile ? (
          loading ? <ul>{Array.from({ length: 8 }, (_, i) => <li key={i} className="border-b border-border p-3"><Skeleton className="h-12" /></li>)}</ul>
          : total === 0 ? <EmptyState icon={filtersActive ? SearchX : undefined} title={empty?.title ?? "No results"} message={filtersActive ? "No rows match your search or filters." : empty?.message}
              action={filtersActive ? <Button variant="outline" size="sm" onClick={reset}>Clear filters</Button> : undefined} />
          : <ul>{visibleRows.map((r) => (
              <li key={r.id} className="border-b border-border last:border-0">
                {onRowClick ? (
                  <button type="button" onClick={() => onRowClick(r.original)} aria-label={rowLabel?.(r.original)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <div className="min-w-0 flex-1">{renderMobile(r.original)}</div><ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                  </button>
                ) : <div className="min-h-[56px] px-4 py-3">{renderMobile(r.original)}</div>}
              </li>))}</ul>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h, i) => {
                    const dir = h.column.getIsSorted();
                    const right = h.column.columnDef.meta?.align === "right";
                    return (
                      <TableHead key={h.id} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                        className={cn(right && "text-right", i === 0 && "sticky left-0 z-30 pl-4", i === hg.headers.length - 1 && "pr-4", h.column.columnDef.meta?.className)}>
                        {h.isPlaceholder ? null : h.column.getCanSort() ? (
                          <button type="button" className={cn("inline-flex items-center gap-1 rounded uppercase tracking-[0.04em] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", right && "flex-row-reverse")} onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? <ArrowUp className="h-3 w-3" /> : dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          </button>
                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            {!loading && total > 0 && (
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.id} className={cn(rowH, onRowClick && "cursor-pointer")} tabIndex={onRowClick ? 0 : undefined} aria-label={rowLabel?.(row.original)}
                    onClick={() => onRowClick?.(row.original)} onKeyDown={(e) => { if (onRowClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRowClick(row.original); } }}>
                    {row.getVisibleCells().map((cell, i) => (
                      <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums", i === 0 && "sticky left-0 z-10 pl-4", i === colCount - 1 && "pr-4", cell.column.columnDef.meta?.className)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            )}
            {loading && (
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r} className={rowH}>{Array.from({ length: colCount }, (_, c) => <TableCell key={c}><Skeleton className="h-4 w-4/5" /></TableCell>)}</TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        )}
        {!error && !loading && total === 0 && !(small && renderMobile) && (
          <EmptyState icon={filtersActive ? SearchX : undefined} title={empty?.title ?? "No results"} message={filtersActive ? "No rows match your search or filters." : empty?.message ?? "Nothing to show yet."}
            action={filtersActive ? <Button variant="outline" size="sm" onClick={reset}>Clear filters</Button> : undefined} />
        )}
      </div>

      {showPager && (
        <div className={cn("flex h-[52px] shrink-0 items-center justify-between gap-3 border-t border-border bg-surface px-3 text-xs text-text-secondary sm:px-4", pagerInset && "pr-[76px] sm:pr-[76px]")}>
          <span className="tabular-nums" data-testid="table-range">{small ? `${from}–${to} of ${total}` : `Showing ${from}–${to} of ${total}`}</span>
          <div className="flex items-center gap-3">
            {!small && (
              <label className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select aria-label="Rows per page" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="h-8 text-xs">
                  {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </label>
            )}
            <div className="flex items-center gap-1">
              {!small && <Button variant="outline" size="icon" aria-label="First page" disabled={page <= 1} onClick={() => goto(1)}><ChevronsLeft /></Button>}
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => goto(page - 1)}><ChevronLeft /></Button>
              {small ? <span className="px-2 tabular-nums">{page} / {pages}</span> : pageList(page, pages).map((p, i) => p === "…"
                ? <span key={`e${i}`} className="w-6 text-center text-text-muted" aria-hidden>…</span>
                : <Button key={p} variant={p === page ? "default" : "ghost"} size="icon" className="tabular-nums" aria-label={`Page ${p}`} aria-current={p === page ? "page" : undefined} onClick={() => goto(p)}>{p}</Button>)}
              <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => goto(page + 1)}><ChevronRight /></Button>
              {!small && <Button variant="outline" size="icon" aria-label="Last page" disabled={page >= pages} onClick={() => goto(pages)}><ChevronsRight /></Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact list item for mobile mode: primary ID + badge on top, two key fields beneath. */
export function MobileItem({ title, badge, fields }: { title: React.ReactNode; badge?: React.ReactNode; fields: [React.ReactNode, React.ReactNode] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium tabular-nums text-text">{title}</span>{badge}</div>
      <div className="flex items-center justify-between gap-2 text-xs text-text-secondary"><span className="truncate">{fields[0]}</span><span className="shrink-0 tabular-nums">{fields[1]}</span></div>
    </div>
  );
}
