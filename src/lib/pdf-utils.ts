type PdfJsModule = typeof import('pdfjs-dist');

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let workerConfigured = false;

export interface TextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  width: number;
}

export interface PDFPageContent {
  pageNumber: number;
  text: string;
  width: number;
  height: number;
  textItems: TextItem[];
}

export interface PDFInfo {
  fileName: string;
  numPages: number;
  pages: PDFPageContent[];
}

interface RawPdfTextItem {
  str?: string;
  transform?: number[];
  fontName?: string;
  width?: number;
}

async function getPdfJsModule(): Promise<PdfJsModule> {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist');
  }

  const module = await pdfJsModulePromise;
  if (!workerConfigured) {
    module.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${module.version}/pdf.worker.min.mjs`;
    workerConfigured = true;
  }

  return module;
}

function asRawPdfTextItem(item: unknown): RawPdfTextItem | null {
  if (!item || typeof item !== 'object') return null;
  return item as RawPdfTextItem;
}

export async function extractPDFContent(file: File): Promise<PDFInfo> {
  const pdfjsLib = await getPdfJsModule();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PDFPageContent[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const textItems: TextItem[] = [];
    const textRuns: string[] = [];

    for (const rawItem of textContent.items as unknown[]) {
      const item = asRawPdfTextItem(rawItem);
      if (!item?.str) continue;

      textRuns.push(item.str);

      const tx = item.transform;
      if (!tx || tx.length < 6) continue;

      textItems.push({
        str: item.str,
        x: tx[4],
        y: viewport.height - tx[5],
        fontSize: Math.abs(tx[0]) || 12,
        fontName: item.fontName || '',
        width: item.width || 0,
      });
    }

    pages.push({
      pageNumber: i,
      text: textRuns.join(' '),
      width: viewport.width,
      height: viewport.height,
      textItems,
    });
  }

  return {
    fileName: file.name,
    numPages: pdf.numPages,
    pages,
  };
}

/**
 * Group text items into logical paragraphs based on y-position gaps.
 * Returns paragraphs with their average fontSize and starting y position.
 */
export interface Paragraph {
  text: string;
  y: number;
  fontSize: number;
  x: number;
}

export function groupIntoParagraphs(items: TextItem[], _pageHeight: number): Paragraph[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const paragraphs: Paragraph[] = [];
  let currentLines: TextItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const prevItem = sorted[i - 1];
    const yGap = Math.abs(item.y - prevItem.y);
    const lineHeight = prevItem.fontSize * 1.4;

    if (yGap < lineHeight * 0.6) {
      currentLines[currentLines.length - 1].push(item);
    } else if (yGap < lineHeight * 1.8) {
      currentLines.push([item]);
    } else {
      paragraphs.push(buildParagraph(currentLines));
      currentLines = [[item]];
    }
  }

  if (currentLines.length > 0) {
    paragraphs.push(buildParagraph(currentLines));
  }

  return paragraphs;
}

function buildParagraph(lines: TextItem[][]): Paragraph {
  const allItems = lines.flat();
  const text = lines.map((line) => line.map((item) => item.str).join(' ')).join('\n');
  const avgFontSize = allItems.reduce((sum, item) => sum + item.fontSize, 0) / allItems.length;
  const minX = Math.min(...allItems.map((item) => item.x));
  const minY = Math.min(...allItems.map((item) => item.y));

  return {
    text,
    y: minY,
    fontSize: Math.round(avgFontSize * 10) / 10,
    x: minX,
  };
}
