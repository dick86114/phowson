import html2canvas from 'html2canvas';

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

export const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, filename);
};

export const downloadCsv = (rows: Array<Record<string, any>>, filename: string) => {
    const headerSet = new Set<string>();
    for (const r of rows) {
        Object.keys(r || {}).forEach((k) => headerSet.add(k));
    }
    const headers = Array.from(headerSet);

    const escape = (v: any) => {
        const raw = v === null || v === undefined ? '' : String(v);
        const needs = /[",\n]/.test(raw);
        const val = raw.replace(/"/g, '""');
        return needs ? `"${val}"` : val;
    };

    const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, filename);
};

export const downloadPngFromElement = async (el: HTMLElement, filename: string) => {
    await (document as any).fonts?.ready;
    const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null,
        logging: false,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
};
