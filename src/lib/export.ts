/** Browser-side export: file download and the share sheet. The builders live in core/backup. */
export { buildBackup, buildCsv, DEFAULT_EXPORT, exportFilename, type ExportChild, type ExportOptions } from '../core/backup';

export function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

/** Returns true if the share sheet was shown, false if the user should fall back to download. */
export async function shareFile(name: string, content: string, type: string): Promise<boolean> {
  const file = new File([content], name, { type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: name });
    return true;
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return true; // user cancelled; nothing else to do
    return false;
  }
}
