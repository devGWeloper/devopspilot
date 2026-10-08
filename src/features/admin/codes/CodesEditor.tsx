"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { FitBadge } from "@/components/ui/FitBadge";
import { Icon } from "@/components/ui/Icon";
import { Callout, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { invalidateRefs, useApi } from "@/lib/hooks";
import { LEVELS, type CodeItem, type Codes, type Project } from "@/lib/types";
import s from "./codes.module.css";

type ListKey = "langs" | "domains" | "sysTypes";

const LISTS: { key: ListKey; title: string; field: (p: Project) => string[] }[] = [
  { key: "langs", title: "주 개발 언어", field: (p) => p.base.langCds },
  { key: "domains", title: "업무 도메인", field: (p) => [p.base.domainCd] },
  { key: "sysTypes", title: "시스템 유형", field: (p) => [p.base.sysTypeCd] },
];

export function CodesEditor() {
  const { toast, toastError } = useToast();
  const { data: loaded, error } = useApi<Codes>("/api/codes");
  const { data: projects } = useApi<Project[]>("/api/projects");
  const [codes, setCodes] = useState<Codes | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded) setCodes(loaded);
  }, [loaded]);

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!codes) return <Skeleton h={400} />;

  const update = (c: Codes) => {
    setCodes(c);
    setDirty(true);
  };
  const setList = (k: ListKey, list: CodeItem[]) => update({ ...codes, [k]: list });
  const setTarget = (patch: Partial<Codes["target"]>) => update({ ...codes, target: { ...codes.target, ...patch } });
  const usage = (k: ListKey, code: string) => (projects ?? []).filter((p) => LISTS.find((l) => l.key === k)!.field(p).includes(code)).length;
  const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  async function save() {
    setBusy(true);
    try {
      setCodes(await api<Codes>("/api/admin/codes", { method: "PUT", body: codes }));
      setDirty(false);
      invalidateRefs();
      toast("코드와 선정 목표를 저장했습니다.");
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const fitSum = LEVELS.reduce((a, lv) => a + codes.target.byFit[lv], 0);

  return (
    <>
      <PageHeader
        eyebrow="Codes & targets"
        title="코드·선정 목표"
        description="과제 분류 코드와 선정 균형 목표입니다. 목표는 대시보드·선정 보드의 균형 경고 기준이 됩니다."
        actions={
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>
            저장
          </Button>
        }
      />
      <Panel eyebrow="Selection target" title="선정 목표" style={{ marginBottom: 16 }}>
        <div className={s.targets}>
          <Field label="선정 목표 건수">
            <TextInput type="number" min={0} value={codes.target.total} onChange={(e) => setTarget({ total: n(e.target.value) })} />
          </Field>
          {LEVELS.map((lv) => (
            <Field key={lv} label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>적합도 <FitBadge fit={lv} size="sm" /> 목표</span>}>
              <TextInput type="number" min={0} value={codes.target.byFit[lv]} onChange={(e) => setTarget({ byFit: { ...codes.target.byFit, [lv]: n(e.target.value) } })} />
            </Field>
          ))}
          <Field label="개발 성격별 최소 건수" hint="신규·혼합·레거시 각각">
            <TextInput type="number" min={0} value={codes.target.minPerDevType} onChange={(e) => setTarget({ minPerDevType: n(e.target.value) })} />
          </Field>
          <Field label="최소 언어 종류">
            <TextInput type="number" min={0} value={codes.target.minLangKinds} onChange={(e) => setTarget({ minLangKinds: n(e.target.value) })} />
          </Field>
        </div>
        {fitSum !== codes.target.total && (
          <p className={s.note}>
            <Icon name="info" size={13} /> 적합도별 목표 합계({fitSum})가 선정 목표({codes.target.total})와 다릅니다.
          </p>
        )}
      </Panel>
      <div className={s.lists}>
        {LISTS.map((l) => (
          <Panel key={l.key} eyebrow="Codes" title={l.title}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>코드</th>
                  <th>이름</th>
                  <th style={{ width: 52, textAlign: "right" }}>사용</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {codes[l.key].map((c, i) => {
                  const used = usage(l.key, c.code);
                  const isNew = !loaded?.[l.key].some((x) => x.code === c.code);
                  return (
                    <tr key={i}>
                      <td>
                        <TextInput
                          value={c.code}
                          disabled={!isNew}
                          title={isNew ? undefined : "기존 코드는 과제 데이터와 연결돼 있어 바꿀 수 없습니다"}
                          onChange={(e) => setList(l.key, codes[l.key].map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase().replace(/\s/g, "_") } : x)))}
                        />
                      </td>
                      <td>
                        <TextInput value={c.label} onChange={(e) => setList(l.key, codes[l.key].map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      </td>
                      <td className="num subtle" style={{ textAlign: "right" }}>
                        {used}
                      </td>
                      <td>
                        <button
                          className={s.del}
                          disabled={used > 0}
                          title={used > 0 ? "사용 중인 코드는 삭제할 수 없습니다" : "삭제"}
                          onClick={() => setList(l.key, codes[l.key].filter((_, j) => j !== i))}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className={s.add} onClick={() => setList(l.key, [...codes[l.key], { code: "", label: "" }])}>
              + 코드 추가
            </button>
          </Panel>
        ))}
      </div>
    </>
  );
}
