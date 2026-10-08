"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./table.module.css";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  width?: number | string;
  align?: "left" | "right" | "center";
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  empty,
  pageSizes = [20, 50, 100],
  initialSort,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  empty?: ReactNode;
  pageSizes?: number[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  dense?: boolean;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSizes[0]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : 1) * dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const cur = Math.min(page, pages - 1);
  const view = sorted.slice(cur * size, cur * size + size);
  const allOnPage = view.length > 0 && view.every((r) => selected?.has(rowKey(r)));

  function toggleAll() {
    const next = new Set(selected);
    for (const r of view) {
      if (allOnPage) next.delete(rowKey(r));
      else next.add(rowKey(r));
    }
    onSelectedChange?.(next);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange?.(next);
  }

  return (
    <div>
      <div className={s.wrap}>
        <table className={`${s.table} ${dense ? s.dense : ""}`}>
          <thead>
            <tr>
              {selectable && (
                <th className={s.checkCol}>
                  <input type="checkbox" aria-label="현재 페이지 전체 선택" checked={allOnPage} onChange={toggleAll} />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} style={{ width: c.width, textAlign: c.align }} className={c.className}>
                    {c.sortValue ? (
                      <button
                        className={`${s.sortBtn} ${active ? s.sortActive : ""}`}
                        onClick={() => setSort(active && sort!.dir === "asc" ? { key: c.key, dir: "desc" } : { key: c.key, dir: "asc" })}
                      >
                        {c.header}
                        <Icon name={active && sort!.dir === "desc" ? "arrowDown" : "arrowUp"} size={12} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const id = rowKey(r);
              return (
                <tr
                  key={id}
                  className={`${onRowClick ? s.clickable : ""} ${selected?.has(id) ? s.selectedRow : ""}`}
                  onClick={() => onRowClick?.(r)}
                >
                  {selectable && (
                    <td className={s.checkCol} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`${id} 선택`} checked={!!selected?.has(id)} onChange={() => toggle(id)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align }} className={c.className}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && empty}
      </div>
      {sorted.length > pageSizes[0] && (
        <div className={s.pager}>
          <span className="muted num">
            {cur * size + 1}–{Math.min(sorted.length, cur * size + size)} / {sorted.length}건
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select className={s.pageSize} value={size} onChange={(e) => (setSize(Number(e.target.value)), setPage(0))} aria-label="페이지 크기">
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}개씩
                </option>
              ))}
            </select>
            <button className={s.pageBtn} disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="이전 페이지">
              <Icon name="chevronLeft" size={14} />
            </button>
            <span className="num" style={{ minWidth: 48, textAlign: "center" }}>
              {cur + 1} / {pages}
            </span>
            <button className={s.pageBtn} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="다음 페이지">
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
