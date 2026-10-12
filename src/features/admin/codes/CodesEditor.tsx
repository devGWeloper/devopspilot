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
import Link from "next/link";
import { CODE_LISTS, ENTRY_FIELDS, type CodeListKey } from "@/lib/projects/fields";
import { LEVELS, type CodeItem, type Codes, type Project } from "@/lib/types";
import s from "./codes.module.css";

type ListKey = CodeListKey;

const LISTS = CODE_LISTS.map((l) => {
  const f = ENTRY_FIELDS.find((x) => x.codes === l.key)!;
  return { ...l, field: (p: Project): string[] => ([] as string[]).concat((p.base[f.key as keyof Project["base"]] as string | string[]) ?? []) };
});

export function CodesEditor() {
  const { toast, toastError } = useToast();
  const { data: loaded, error } = useApi<Codes>("/api/codes");
  const { data: projects } = useApi<Project[]>("/api/projects");
  const [codes, setCodes] = useState<Codes | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<ListKey>(LISTS[0].key);

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
        description="과제 선정 양식(엑셀) '코드값' 시트의 선택값과 선정 균형 목표입니다. 정의·예시는 과제 기입 화면에서 선택지 설명으로 보입니다."
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
          <Field label="과제 영역별 최소 건수" hint="'혼합'을 뺀 과제 영역 각각">
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
        <nav className={s.listNav} aria-label="코드 목록">
          {LISTS.map((l) => (
            <button key={l.key} type="button" className={s.listBtn} aria-current={active === l.key ? "true" : undefined} onClick={() => setActive(l.key)}>
              <span className={s.listRef}>{l.ref.startsWith("ADD") ? "포털" : l.ref}</span>
              <span>{l.title}</span>
              <span className="subtle num">{codes[l.key].length}</span>
            </button>
          ))}
          <p className={s.navNote}>
            Major·Minor 지표(FIT-01~03, WBS 실적·도구·AI 역량)의 선택지는 수준과 함께 <Link href="/admin/criteria">평가 기준</Link>에서 관리합니다.
          </p>
        </nav>
        {LISTS.filter((l) => l.key === active).map((l) => (
          <Panel key={l.key} eyebrow={l.ref.startsWith("ADD") ? "포털 추가 항목" : `양식 ${l.ref}`} title={l.title}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>코드</th>
                  <th style={{ width: 180 }}>이름</th>
                  <th>정의</th>
                  <th style={{ width: 200 }}>예시</th>
                  <th style={{ width: 52, textAlign: "right" }}>사용</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {codes[l.key].map((c, i) => {
                  const used = usage(l.key, c.code);
                  const isNew = !loaded?.[l.key].some((x) => x.code === c.code);
                  const patch = (x: Partial<CodeItem>) => setList(l.key, codes[l.key].map((y, j) => (j === i ? { ...y, ...x } : y)));
                  return (
                    <tr key={i}>
                      <td>
                        <TextInput
                          value={c.code}
                          disabled={!isNew}
                          title={isNew ? undefined : "기존 코드는 과제 데이터와 연결돼 있어 바꿀 수 없습니다"}
                          onChange={(e) => patch({ code: e.target.value.toUpperCase().replace(/\s/g, "_") })}
                        />
                      </td>
                      <td>
                        <TextInput value={c.label} onChange={(e) => patch({ label: e.target.value })} />
                      </td>
                      <td>
                        <TextInput value={c.desc ?? ""} placeholder="—" onChange={(e) => patch({ desc: e.target.value || undefined })} />
                      </td>
                      <td>
                        <TextInput value={c.example ?? ""} placeholder="—" onChange={(e) => patch({ example: e.target.value || undefined })} />
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
            <p className={s.navNote} style={{ marginTop: 10 }}>
              코드 ETC·MIXED 를 고른 과제는 비고(REF-04)가 필수가 됩니다.
            </p>
          </Panel>
        ))}
      </div>
    </>
  );
}
