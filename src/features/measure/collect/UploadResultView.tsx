import { Callout } from "@/components/ui/Panel";

export interface UploadResult {
  inserted: number;
  updated: number;
  warnings: { line: number; message: string }[];
  preview: unknown[];
}

export function UploadResultView({ result }: { result: UploadResult }) {
  const shown = result.warnings.slice(0, 50);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
        <span>
          신규 <b className="num" style={{ fontSize: 22 }}>{result.inserted}</b>
        </span>
        <span>
          갱신 <b className="num" style={{ fontSize: 22 }}>{result.updated}</b>
        </span>
        <span style={{ color: result.warnings.length ? "var(--warn)" : undefined }}>
          경고 <b className="num" style={{ fontSize: 22 }}>{result.warnings.length}</b>
        </span>
      </div>
      {shown.length > 0 && (
        <Callout tone="warn">
          <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 180, overflow: "auto" }}>
            {shown.map((w, i) => (
              <li key={i}>
                {w.line > 0 && <span className="num">{w.line}행: </span>}
                {w.message}
              </li>
            ))}
          </ul>
          {result.warnings.length > shown.length && <div>외 {result.warnings.length - shown.length}건</div>}
        </Callout>
      )}
    </div>
  );
}
