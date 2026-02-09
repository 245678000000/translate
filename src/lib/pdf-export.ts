import jsPDF from 'jspdf';
import { type PDFPageContent, groupIntoParagraphs, type Paragraph } from './pdf-utils';

export interface TranslatedPage {
  pageNumber: number;
  originalText: string;
  translatedText: string;
  /** Original page metadata for layout reconstruction */
  pageWidth?: number;
  pageHeight?: number;
  paragraphs?: Paragraph[];
}

// Points to mm conversion (1 pt = 0.3528 mm)
const PT_TO_MM = 0.3528;

/**
 * Load a CJK-capable font (Noto Sans SC) and register it with jsPDF.
 * Falls back to Helvetica if loading fails.
 */
let fontLoaded = false;
let fontLoadPromise: Promise<void> | null = null;

async function ensureCJKFont(doc: jsPDF): Promise<string> {
  const FONT_NAME = 'NotoSansSC';

  if (fontLoaded) {
    doc.setFont(FONT_NAME, 'normal');
    return FONT_NAME;
  }

  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      try {
        const resp = await fetch(
          'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.woff2'
        );
        if (!resp.ok) throw new Error('Font fetch failed');
        const buf = await resp.arrayBuffer();

        // Convert to base64
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        // Register font globally for jsPDF
        const callAddFont = function (this: any) {
          this.addFileToVFS('NotoSansSC-Regular.woff2', base64);
          this.addFont('NotoSansSC-Regular.woff2', FONT_NAME, 'normal');
        };

        // @ts-ignore — jsPDF plugin API
        jsPDF.API.events.push(['addFonts', callAddFont]);
        fontLoaded = true;
      } catch (e) {
        console.warn('Failed to load CJK font, Chinese characters may not render:', e);
      }
    })();
  }

  await fontLoadPromise;

  if (fontLoaded) {
    // Need a fresh doc instance after registering font events
    // The font will be available on subsequent new jsPDF() calls
    return FONT_NAME;
  }
  return 'helvetica';
}

/**
 * Export translated content as a formatted PDF, trying to preserve
 * the original layout structure (paragraph positions, font sizes, spacing).
 */
export async function exportTranslatedPDF(
  translatedPages: TranslatedPage[],
  originalFileName: string
): Promise<void> {
  // Pre-load the CJK font
  const testDoc = new jsPDF();
  const fontName = await ensureCJKFont(testDoc);

  // Create the real doc (font events are now registered)
  const firstPage = translatedPages[0];
  const pageW = firstPage?.pageWidth ? firstPage.pageWidth * PT_TO_MM : 210;
  const pageH = firstPage?.pageHeight ? firstPage.pageHeight * PT_TO_MM : 297;

  const doc = new jsPDF({
    unit: 'mm',
    format: [pageW, pageH],
  });

  if (fontName !== 'helvetica') {
    try {
      doc.setFont(fontName, 'normal');
    } catch {
      // fallback
    }
  }

  const margin = 15;

  translatedPages.forEach((page, index) => {
    if (index > 0) {
      const w = page.pageWidth ? page.pageWidth * PT_TO_MM : 210;
      const h = page.pageHeight ? page.pageHeight * PT_TO_MM : 297;
      doc.addPage([w, h]);
    }

    const currentPageW = doc.internal.pageSize.getWidth();
    const currentPageH = doc.internal.pageSize.getHeight();
    const maxWidth = currentPageW - margin * 2;

    if (fontName !== 'helvetica') {
      try {
        doc.setFont(fontName, 'normal');
      } catch { /* fallback */ }
    }

    // If we have paragraph structure, use it for layout
    if (page.paragraphs && page.paragraphs.length > 0) {
      renderWithParagraphs(doc, page, maxWidth, margin, currentPageW, currentPageH, fontName);
    } else {
      renderPlainText(doc, page, maxWidth, margin, currentPageH, fontName);
    }
  });

  const nameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
  doc.save(`${nameWithoutExt}_translated.pdf`);
}

function renderWithParagraphs(
  doc: jsPDF,
  page: TranslatedPage,
  maxWidth: number,
  margin: number,
  pageW: number,
  pageH: number,
  fontName: string,
) {
  const paragraphs = page.paragraphs!;
  const origPageH = page.pageHeight || 842; // default A4 in points

  // Split translated text into chunks matching paragraph count
  const translatedChunks = splitTranslatedText(page.translatedText, paragraphs.length);

  let y = margin;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const translatedText = translatedChunks[i] || '';
    if (!translatedText.trim()) continue;

    // Calculate relative y position
    const relativeY = (para.y / origPageH) * pageH;
    // Use the larger of calculated position or current y (avoid overlap)
    const targetY = Math.max(y, relativeY > margin ? relativeY : y);

    // Scale font size (with bounds)
    const fontSize = Math.max(8, Math.min(para.fontSize, 24));
    doc.setFontSize(fontSize);

    if (fontName !== 'helvetica') {
      try { doc.setFont(fontName, 'normal'); } catch { /* fallback */ }
    }

    // Calculate left margin from original x position
    const relativeX = Math.max(margin, (para.x / (page.pageWidth || 595)) * pageW);
    const effectiveMaxWidth = pageW - relativeX - margin;
    const textMaxWidth = Math.max(effectiveMaxWidth, maxWidth * 0.5);

    const lines = doc.splitTextToSize(translatedText, textMaxWidth);
    const lineHeight = fontSize * 0.4; // mm per line

    y = targetY;
    for (const line of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
        if (fontName !== 'helvetica') {
          try { doc.setFont(fontName, 'normal'); } catch { /* fallback */ }
        }
        doc.setFontSize(fontSize);
      }
      doc.text(line, relativeX, y);
      y += lineHeight;
    }

    y += lineHeight * 0.5; // paragraph spacing
  }
}

function renderPlainText(
  doc: jsPDF,
  page: TranslatedPage,
  maxWidth: number,
  margin: number,
  pageH: number,
  fontName: string,
) {
  let y = margin;

  // Page header
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`— ${page.pageNumber} —`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  y += 8;

  // Content
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  if (fontName !== 'helvetica') {
    try { doc.setFont(fontName, 'normal'); } catch { /* fallback */ }
  }

  // Split by double newlines to detect paragraphs
  const paragraphs = page.translatedText.split(/\n{2,}/);
  const lineHeight = 5.5;

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const lines = doc.splitTextToSize(para.trim(), maxWidth);
    for (const line of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
        if (fontName !== 'helvetica') {
          try { doc.setFont(fontName, 'normal'); } catch { /* fallback */ }
        }
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += lineHeight * 0.6; // paragraph gap
  }
}

/**
 * Split translated text into N chunks, one per original paragraph.
 * Uses double-newlines as paragraph separators; falls back to even splitting.
 */
function splitTranslatedText(text: string, count: number): string[] {
  if (count <= 1) return [text];

  // Try splitting by double newlines first
  const parts = text.split(/\n{2,}/).filter(p => p.trim());
  if (parts.length >= count) {
    // Merge excess parts into the last chunk
    const result = parts.slice(0, count - 1);
    result.push(parts.slice(count - 1).join('\n\n'));
    return result;
  }

  // Try single newlines
  const lines = text.split(/\n/).filter(p => p.trim());
  if (lines.length >= count) {
    const chunkSize = Math.ceil(lines.length / count);
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(lines.slice(i * chunkSize, (i + 1) * chunkSize).join('\n'));
    }
    return result;
  }

  // Not enough breaks, just return the whole text as first chunk
  const result = [text];
  while (result.length < count) result.push('');
  return result;
}
