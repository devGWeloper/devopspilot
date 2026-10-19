"use client";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { f1 } from "@/lib/format";
import { FORM_FIELDS, FORM_GROUPS, missingRequired, tally, type FormField, type FormGroup } from "@/lib/projects/form";
import type { SelReqVM, SelectionVM } from "@/lib/views";
import { AXES, BLANK, distOf, getter, val, type Axis } from "./axes";
import { CrossPanel, DistPanel } from "./DistPanel";
import s from "./selection.module.css";

// 과제 속성은 과제 줄에 한 번만 보여 주고, 열로는 요구사항 이하 항목만 편다 — 엑셀처럼 행마다 반복하면 읽을 게 너무 많다.
const PRJ_INFO = FORM_FIELDS.filter((x) => x.group === "PRJ" && x.id !== "PRJ-01");
const COL_GROUPS = FORM_GROUPS.filter((g) => g.key !== "PRJ");
const DEFAULT_ON: FormGroup[] = ["REQ", "FIT"];
const MAIN_FILTERS = ["PRJ-01", "PRJ-03", "PRJ-06", "REQ-03", "REQ-04", "REQ-05", "FIT-06"];
const MORE_FILTERS = AXES.map((a) => a.id).filter((id) => !MAIN_FILTERS.includes(id));
const LONG = new Set<string>();

function filterAxes(vm: SelectionVM): Record<string, Axis> {
  const prj: Axis = { id: "PRJ-01", label: "과제", group: "PRJ", level: "prj", options: vm.projects.map((p) => p.prjNm), get: (r) => val(r, "PRJ-01"), check: false };
  return Object.fromEntries([prj, ...AXES].map((a) => [a.id, a]));
}

/** 양식 선택값 순서대로, 양식 밖에서 직접 적은 값은 뒤에 */
function optionsOf(a: Axis, reqs: SelReqVM[]): { v: string; n: number }[] {
  const seen = reqs.map(a.get);
  const blank = seen.filter((x) => !x).length;
  const out = tally(a.options, seen);
  return blank ? [...out, { v: BLANK, n: blank }] : out;
}

export function SelectionDashboard({ vm }: { vm: SelectionVM }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [more, setMore] = useState(false);
  const [groups, setGroups] = useState<Set<FormGroup>>(new Set(DEFAULT_ON));
  const [open, setOpen] = useState<string | null>(null);
  const fAxes = useMemo(() => filterAxes(vm), [vm]);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return vm.reqs.filter(
      (r) =>
        Object.entries(filters).every(([id, v]) => {
          const get = fAxes[id]?.get ?? getter(id);
          return !v || (v === BLANK ? !get(r) : get(r) === v);
        }) &&
        (!kw || ["PRJ-01", "REQ-01", "REQ-02", "REQ-08", "PRJ-05"].some((id) => val(r, id).toLowerCase().includes(kw))),
    );
  }, [vm.reqs, filters, q, fAxes]);

  // 분포에서 고른 값은 표 위 필터로 이어진다. 같은 값을 다시 누르면 푼다.
  const pick = (pairs: [string, string][]) => {
    const toggleOff = pairs.length === 1 && filters[pairs[0][0]] === pairs[0][1];
    setFilters({ ...filters, ...Object.fromEntries(pairs.map(([id, v]) => [id, toggleOff ? "" : v])) });
    if (!toggleOff) document.getElementById("sel-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!vm.reqs.length)
    return (
      <>
        <PageHeader eyebrow="Phase 1 결과" title="과제 선정 현황" />
        <Panel>
          <EmptyState title="아직 선정된 과제가 없습니다">관리자가 기준 데이터에서 엑셀을 올리면 여기에 과제·요구사항이 나타납니다.</EmptyState>
        </Panel>
      </>
    );

  const missing = vm.reqs.filter((r) => missingRequired(r.values).length).length;
  const warnN = AXES.reduce((n, a) => n + distOf(vm, a).warns.length, 0);
  const shownFilters = [...MAIN_FILTERS, ...MORE_FILTERS.filter((id) => more || filters[id])];
  const cols = COL_GROUPS.filter((g) => groups.has(g.key)).map((g) => ({
    ...g,
    fields: FORM_FIELDS.filter((x) => x.group === g.key && !(g.key === "REQ" && (x.id === "REQ-01" || x.id === "REQ-02"))),
  }));
  const colN = 1 + cols.reduce((a, g) => a + g.fields.length, 0);
  const active = Object.values(filters).filter(Boolean).length + (q.trim() ? 1 : 0);
  const shownPrj = vm.projects.filter((p) => rows.some((r) => r.prjId === p.prjId));

  const toggle = (g: FormGroup) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <>
      <PageHeader
        eyebrow="Phase 1 결과"
        title="과제 선정 현황"
        description="기준정보 엑셀 '01. 과제'·'02. 요구사항-SDLC' 에 입력된 내용을 요구사항 × 단계 단위로 봅니다. 선택값으로 걸러 보고, 행을 누르면 전체 항목이 펼쳐집니다."
      >
        <div className={s.kpis}>
          <KpiTile label="선정 과제" value={vm.projects.length} unit="건" />
          <KpiTile label="요구사항 (단계)" value={vm.reqs.length} unit="건" />
          <KpiTile label="기준 공수" value={f1(vm.reqs.reduce((a, r) => a + r.baseMd, 0))} unit="M/D" sub="AI 미적용 기준" />
          <KpiTile label="균형 점검" value={<span className={warnN ? s.warnTxt : ""}>{warnN}</span>} unit="건" sub={warnN ? "쏠림·공백·미입력 — 분포 참고" : "쏠림·공백 없음"} />
          <KpiTile label="필수 미입력" value={<span className={missing ? s.miss : ""}>{missing}</span>} unit="건" sub="필수 항목이 빈 요구사항" />
        </div>
      </PageHeader>

      <DistPanel vm={vm} filters={filters} onPick={(id, v) => pick([[id, v]])} />
      <CrossPanel vm={vm} onPick={pick} />

      <Panel
        id="sel-table"
        flush
        style={{ marginTop: 20 }}
        title="과제·요구사항"
        actions={
          <div className={s.groups} role="group" aria-label="표시할 항목 그룹">
            {COL_GROUPS.map((g) => (
              <button key={g.key} type="button" className={`${s.groupBtn} ${groups.has(g.key) ? s.on : ""}`} aria-pressed={groups.has(g.key)} onClick={() => toggle(g.key)}>
                {g.title}
              </button>
            ))}
          </div>
        }
      >
        <div className={s.toolbar}>
          <TextInput className={s.search} placeholder="과제명 · 태그 · 요구사항 · 담당 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />
          {shownFilters.map((id) => {
            const a = fAxes[id];
            return (
              <Select
                key={id}
                aria-label={a.label}
                className={`${s.filter} ${filters[id] ? s.filterOn : ""}`}
                value={filters[id] ?? ""}
                onChange={(e) => setFilters({ ...filters, [id]: e.target.value })}
              >
                <option value="">{a.label} 전체</option>
                {optionsOf(a, vm.reqs).map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v === BLANK ? "미입력" : o.v} ({o.n})
                  </option>
                ))}
              </Select>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => setMore(!more)}>
            {more ? "필터 접기" : `필터 더보기 ${MORE_FILTERS.length}`}
          </Button>
          {active > 0 && (
            <Button variant="ghost" size="sm" onClick={() => (setFilters({}), setQ(""))}>
              초기화
            </Button>
          )}
          <span className={s.count}>
            {active ? `${rows.length} / ${vm.reqs.length}건` : `${vm.reqs.length}건`}
          </span>
        </div>

        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr className={s.groupRow}>
                <th className={s.first}>{groups.has("REQ") ? "" : "② 요구사항"}</th>
                {cols.map((g) => (
                  <th key={g.key} colSpan={g.fields.length}>
                    {g.title}
                  </th>
                ))}
              </tr>
              <tr>
                <th className={s.first}>요구사항 · 공수 태그</th>
                {cols.flatMap((g) =>
                  g.fields.map((fd) => (
                    <th key={fd.id} className={fd.kind === "number" ? s.r : ""}>
                      {fd.label}
                      <small>{fd.id}</small>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {shownPrj.map((p) => {
                const rs = rows.filter((r) => r.prjId === p.prjId);
                return (
                  <Fragment key={p.prjId}>
                    <tr className={s.prj}>
                      <td colSpan={colN}>
                        <div className={s.prjHead}>
                          <b>{p.prjNm}</b>
                          <span className="subtle">
                            요구사항 {rs.length}건 · {f1(rs.reduce((a, r) => a + r.baseMd, 0))} M/D
                          </span>
                        </div>
                        <div className={s.prjInfo}>
                          {PRJ_INFO.map((fd) => {
                            const v = val(rs[0], fd.id);
                            return (
                              <span key={fd.id}>
                                <i>{fd.label}</i> {v || <Missing required={fd.required} />}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                    {rs.map((r) => (
                      <Fragment key={r.reqId}>
                        <tr className={`${s.req} ${open === r.reqId ? s.opened : ""}`} onClick={() => setOpen(open === r.reqId ? null : r.reqId)}>
                          <td className={s.first}>
                            <div className={s.reqName}>
                              <Icon name={open === r.reqId ? "chevronDown" : "chevronRight"} size={12} />
                              <b>{val(r, "REQ-01") || <Missing required />}</b>
                            </div>
                            <span className={s.reqId}>{r.name}</span>
                          </td>
                          {cols.flatMap((g) => g.fields.map((fd) => <Cell key={fd.id} fd={fd} v={val(r, fd.id)} />))}
                        </tr>
                        {open === r.reqId && (
                          <tr className={s.detailRow}>
                            <td colSpan={colN}>
                              <Detail r={r} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="조건에 맞는 요구사항이 없습니다">필터를 줄이거나 초기화해 보세요.</EmptyState>}
        </div>
      </Panel>
    </>
  );
}

function Missing({ required }: { required?: boolean }) {
  return required ? <span className={s.miss}>미입력</span> : <span className="subtle">—</span>;
}

function Cell({ fd, v }: { fd: FormField; v: string }) {
  if (!v)
    return (
      <td>
        <Missing required={fd.required} />
      </td>
    );
  if (fd.kind === "number") return <td className={s.r}>{fd.id === "REQ-06" ? f1(Number(v)) : v}</td>;
  if (LONG.has(fd.id))
    return (
      <td>
        <span className={s.long} title={v}>
          {v}
        </span>
      </td>
    );
  return <td className={s.nowrap}>{v}</td>;
}

/** 펼친 행 — 양식의 전체 항목을 그룹·순서 그대로 */
function Detail({ r }: { r: SelReqVM }) {
  return (
    <div className={s.detail}>
      {FORM_GROUPS.map((g) => (
        <section key={g.key}>
          <h4>{g.title}</h4>
          <dl>
            {FORM_FIELDS.filter((x) => x.group === g.key).map((fd) => {
              const v = val(r, fd.id);
              return (
                <Fragment key={fd.id}>
                  <dt>
                    {fd.label}
                    <small>{fd.id}</small>
                  </dt>
                  <dd>{v ? (fd.id === "REQ-06" ? `${f1(Number(v))} M/D` : v) : <Missing required={fd.required} />}</dd>
                </Fragment>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
