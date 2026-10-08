"use client";

import { Field, Select, Textarea, TextInput } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import type { ProjectInput } from "@/lib/projects/validate";
import type { Codes } from "@/lib/types";
import s from "./form.module.css";

export function StepBasic({
  input,
  update,
  codes,
  pms,
  isAdmin,
  errOf,
}: {
  input: ProjectInput;
  update: (p: Partial<ProjectInput>) => void;
  codes: Codes;
  pms: { userId: string; userNm: string; deptNm: string }[];
  isAdmin: boolean;
  errOf: (f: string) => string | null;
}) {
  const base = input.base;
  const setBase = (patch: Partial<ProjectInput["base"]>) => update({ base: { ...base, ...patch } });

  function toggleLang(code: string) {
    const has = base.langCds.includes(code);
    setBase({ langCds: has ? base.langCds.filter((c) => c !== code) : [...base.langCds, code] });
  }

  return (
    <Panel eyebrow="Step 1" title="기본 정보">
      <div className={s.formGrid}>
        <Field label="과제명" required htmlFor="prjNm" error={errOf("prjNm")}>
          <TextInput id="prjNm" value={input.prjNm} onChange={(e) => update({ prjNm: e.target.value })} maxLength={200} invalid={!!errOf("prjNm")} placeholder="예) 설비 이력 조회 시스템 고도화" />
        </Field>
        <Field label="시스템명" required htmlFor="sysNm" error={errOf("sysNm")}>
          <TextInput id="sysNm" value={input.sysNm} onChange={(e) => update({ sysNm: e.target.value })} maxLength={200} invalid={!!errOf("sysNm")} placeholder="예) EQP-Hist" />
        </Field>
        <Field label="업무 도메인" required htmlFor="domainCd" error={errOf("domainCd")}>
          <Select id="domainCd" value={base.domainCd} onChange={(e) => setBase({ domainCd: e.target.value })} invalid={!!errOf("domainCd")}>
            <option value="">선택</option>
            {codes.domains.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="시스템 유형" required htmlFor="sysTypeCd" error={errOf("sysTypeCd")}>
          <Select id="sysTypeCd" value={base.sysTypeCd} onChange={(e) => setBase({ sysTypeCd: e.target.value })} invalid={!!errOf("sysTypeCd")}>
            <option value="">선택</option>
            {codes.sysTypes.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className={s.full}>
          <Field label="주 개발 언어" required error={errOf("langCds")} hint="여러 개 선택할 수 있고, 처음 선택한 언어가 주 언어로 집계됩니다.">
            <div className={s.chips} role="group" aria-label="주 개발 언어">
              {codes.langs.map((l) => {
                const idx = base.langCds.indexOf(l.code);
                return (
                  <button key={l.code} type="button" className={s.chipBtn} aria-pressed={idx >= 0} onClick={() => toggleLang(l.code)}>
                    {idx === 0 && <span className={s.mainTag}>주</span>}
                    {l.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <Field label="프레임워크·기술 스택" htmlFor="techStack">
          <TextInput id="techStack" value={base.techStack} onChange={(e) => setBase({ techStack: e.target.value })} maxLength={500} placeholder="예) Spring Boot, React, Oracle" />
        </Field>
        <Field label="담당 조직" htmlFor="orgNm">
          <TextInput id="orgNm" value={base.orgNm} onChange={(e) => setBase({ orgNm: e.target.value })} maxLength={100} />
        </Field>
        {isAdmin && (
          <Field label="과제 PM" required htmlFor="pm" error={errOf("pmUserId")}>
            <Select id="pm" value={input.pmUserId ?? ""} onChange={(e) => update({ pmUserId: e.target.value })} invalid={!!errOf("pmUserId")}>
              <option value="">선택</option>
              {pms.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.userNm} ({u.userId}{u.deptNm ? ` · ${u.deptNm}` : ""})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className={s.full}>
          <Field label="과제 설명" required htmlFor="desc" error={errOf("description")} hint="무엇을 만든(고친) 과제인지, Replay 대상 범위가 어디인지 적어 주세요.">
            <Textarea id="desc" rows={5} value={base.description} onChange={(e) => setBase({ description: e.target.value })} maxLength={4000} invalid={!!errOf("description")} />
          </Field>
        </div>
      </div>
    </Panel>
  );
}
