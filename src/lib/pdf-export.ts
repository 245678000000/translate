import { type Paragraph } from './pdf-utils';

type JsPDFConstructor = typeof import('jspdf')['default'];
type JsPDFDocument = InstanceType<JsPDFConstructor>;

let jsPDFCtorPromise: Promise<JsPDFConstructor> | null = null;
let cachedFontBase64: string | null = null;

export interface TranslatedPage {
  pageNumber: number;
  originalText: string;
  translatedText: string;
  pageWidth?: number;
  pageHeight?: number;
  paragraphs?: Paragraph[];
}

async function getJsPDFConstructor(): Promise<JsPDFConstructor> {
  if (!jsPDFCtorPromise) {
    jsPDFCtorPromise = import('jspdf').then((module) => module.default);
  }
  return jsPDFCtorPromise;
}

async function loadCJKFont(doc: JsPDFDocument): Promise<boolean> {
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

function setFont(doc: JsPDFDocument, hasCJK: boolean) {
  if (hasCJK) {
    try {
      doc.setFont('NotoSansSC', 'normal');
    } catch {
      // fallback
    }
  }
}

export async function exportTranslatedPDF(
  translatedPages: TranslatedPage[],
  originalFileName: string
): Promise<void> {
  const jsPDF = await getJsPDFConstructor();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const hasCJK = await loadCJKFont(doc);
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxWidth = pageW - margin * 2;
  const fontSize = 11;
  const lineHeight = 5.5;
  const paraGap = 3;

  translatedPages.forEach((page, index) => {
    if (index > 0) doc.addPage();

    setFont(doc, hasCJK);
    let y = margin;

    doc.setFontSize(9);
    doc.setTextColor(180, 180, 180);
    doc.text(`- ${page.pageNumber} -`, pageW / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(fontSize);
    doc.setTextColor(30, 30, 30);
    setFont(doc, hasCJK);

    const paragraphs = page.translatedText
      .replace(/\n{3,}/g, '\n\n')
      .split(/\n{2,}/)
      .filter((p) => p.trim());

    for (const para of paragraphs) {
      const trimmed = para.replace(/[ \t]{3,}/g, '  ').trim();
      if (!trimmed) continue;

      const lines = doc.splitTextToSize(trimmed, maxWidth);
      for (const line of lines) {
        if (y > pageH - margin) {
          doc.addPage();
          y = margin;
          setFont(doc, hasCJK);
          doc.setFontSize(fontSize);
          doc.setTextColor(30, 30, 30);
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      y += paraGap;
    }
  });

  const nameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
  doc.save(`${nameWithoutExt}_translated.pdf`);
}
