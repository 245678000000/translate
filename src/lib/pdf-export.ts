import jsPDF from 'jspdf';
import { type Paragraph } from './pdf-utils';

export interface TranslatedPage {
  pageNumber: number;
  originalText: string;
  translatedText: string;
  pageWidth?: number;
  pageHeight?: number;
  paragraphs?: Paragraph[];
}

const PT_TO_MM = 0.3528;

let cachedFontBase64: string | null = null;

async function loadCJKFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!cachedFontBase64) {
      const resp = await fetch(
        'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.ttf'
      );
      if (!resp.ok) throw new Error('Font fetch failed');
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      cachedFontBase64 = btoa(binary);
    }

    doc.addFileToVFS('NotoSansSC.ttf', cachedFontBase64);
    doc.addFont('NotoSansSC.ttf', 'NotoSansSC', 'normal');
    doc.setFont('NotoSansSC', 'normal');
    return true;
  } catch (e) {
    console.warn('Failed to load CJK font:', e);
    return false;
  }
}

export async function exportTranslatedPDF(
  translatedPages: TranslatedPage[],
  originalFileName: string
): Promise<void> {
  const firstPage = translatedPages[0];
  const pageW = firstPage?.pageWidth ? firstPage.pageWidth * PT_TO_MM : 210;
  const pageH = firstPage?.pageHeight ? firstPage.pageHeight * PT_TO_MM : 297;

  const doc = new jsPDF({ unit: 'mm', format: [pageW, pageH] });
  const hasCJK = await loadCJKFont(doc);
  const margin = 15;

  translatedPages.forEach((page, index) => {
    if (index > 0) {
      const w = page.pageWidth ? page.pageWidth * PT_TO_MM : 210;
      const h = page.pageHeight ? page.pageHeight * PT_TO_MM : 297;
      doc.addPage([w, h]);
    }

    if (hasCJK) doc.setFont('NotoSansSC', 'normal');

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const maxWidth = pw - margin * 2;

    if (page.paragraphs && page.paragraphs.length > 0) {
      renderWithParagraphs(doc, page, maxWidth, margin, pw, ph, hasCJK);
    } else {
      renderPlainText(doc, page, maxWidth, margin, ph, hasCJK);
    }
  });

  const nameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
  doc.save(`${nameWithoutExt}_translated.pdf`);
}

function setFont(doc: jsPDF, hasCJK: boolean) {
  if (hasCJK) {
    try { doc.setFont('NotoSansSC', 'normal'); } catch { /* fallback */ }
  }
}

function renderWithParagraphs(
  doc: jsPDF, page: TranslatedPage, maxWidth: number, margin: number,
  pageW: number, pageH: number, hasCJK: boolean,
) {
  const paragraphs = page.paragraphs!;
  const origPageH = page.pageHeight || 842;
  const translatedChunks = splitTranslatedText(page.translatedText, paragraphs.length);
  let y = margin;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = translatedChunks[i] || '';
    if (!text.trim()) continue;

    const relativeY = (para.y / origPageH) * pageH;
    const targetY = Math.max(y, relativeY > margin ? relativeY : y);
    const fontSize = Math.max(8, Math.min(para.fontSize, 24));
    doc.setFontSize(fontSize);
    setFont(doc, hasCJK);

    const relativeX = Math.max(margin, (para.x / (page.pageWidth || 595)) * pageW);
    const textMaxWidth = Math.max(pageW - relativeX - margin, maxWidth * 0.5);
    const lines = doc.splitTextToSize(text, textMaxWidth);
    const lineHeight = fontSize * 0.4;

    y = targetY;
    for (const line of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
        setFont(doc, hasCJK);
        doc.setFontSize(fontSize);
      }
      doc.text(line, relativeX, y);
      y += lineHeight;
    }
    y += lineHeight * 0.5;
  }
}

function renderPlainText(
  doc: jsPDF, page: TranslatedPage, maxWidth: number, margin: number,
  pageH: number, hasCJK: boolean,
) {
  let y = margin;
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`— ${page.pageNumber} —`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  setFont(doc, hasCJK);

  const paragraphs = page.translatedText.split(/\n{2,}/);
  const lineHeight = 5.5;

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const lines = doc.splitTextToSize(para.trim(), maxWidth);
    for (const line of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
        setFont(doc, hasCJK);
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += lineHeight * 0.6;
  }
}

function splitTranslatedText(text: string, count: number): string[] {
  if (count <= 1) return [text];
  const parts = text.split(/\n{2,}/).filter(p => p.trim());
  if (parts.length >= count) {
    const result = parts.slice(0, count - 1);
    result.push(parts.slice(count - 1).join('\n\n'));
    return result;
  }
  const lines = text.split(/\n/).filter(p => p.trim());
  if (lines.length >= count) {
    const chunkSize = Math.ceil(lines.length / count);
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(lines.slice(i * chunkSize, (i + 1) * chunkSize).join('\n'));
    }
    return result;
  }
  const result = [text];
  while (result.length < count) result.push('');
  return result;
}
