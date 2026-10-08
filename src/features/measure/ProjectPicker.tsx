"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Select } from "@/components/ui/Field";
import { useApi } from "@/lib/hooks";
import type { Project } from "@/lib/types";

// 측정은 선정된 과제만 대상이므로 선택 목록도 선정 과제로 한정하고, URL(?prj=)에 남겨 링크 공유가 되게 한다.
export function useSelectedProject(): { projects: Project[] | null; prjId: string | null; setPrjId: (id: string) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { data } = useApi<Project[]>("/api/projects?status=SELECTED");
  const prjId = sp.get("prj") ?? data?.[0]?.prjId ?? null;

  function setPrjId(id: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("prj", id);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  useEffect(() => {
    if (data && data.length && !sp.get("prj")) setPrjId(data[0].prjId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return { projects: data, prjId, setPrjId };
}

export function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
      <span className="muted">과제</span>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 280 }} aria-label="측정 과제">
        {projects.map((p) => (
          <option key={p.prjId} value={p.prjId}>
            {p.prjId} · {p.prjNm}
          </option>
        ))}
      </Select>
    </label>
  );
}
