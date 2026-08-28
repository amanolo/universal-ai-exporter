/**
 * Universal AI Exporter - Download Helper
 * Triggers clean client-side file downloads using Blob URLs
 */

export function downloadBlob(content: Blob | string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: `${mimeType};charset=utf-8` }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

export function sanitizeFilename(name: string, extension: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 50);

  const dateStr = new Date().toISOString().slice(0, 10);
  return `${clean || 'ai-export'}-${dateStr}.${extension}`;
}
