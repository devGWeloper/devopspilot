// 사내망 http 주소에서는 navigator.clipboard 가 없어서 예전 방식으로도 복사한다.
export function copyText(v: string) {
  if (window.isSecureContext && navigator.clipboard) {
    void navigator.clipboard.writeText(v);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = v;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}
