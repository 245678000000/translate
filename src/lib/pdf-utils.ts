import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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

export async function extractPDFContent(file: File): Promise<PDFInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PDFPageContent[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const textItems: TextItem[] = [];
    for (const item of textContent.items as any[]) {
      if (!item.str) continue;
      const tx = item.transform;
      textItems.push({
        str: item.str,
        x: tx[4],
        y: viewport.height - tx[5], // flip y (PDF origin is bottom-left)
        fontSize: Math.abs(tx[0]) || 12,
        fontName: item.fontName || '',
        width: item.width || 0,
      });
    }

    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ');

    pages.push({
      pageNumber: i,
      text,
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

export function groupIntoParagraphs(items: TextItem[], pageHeight: number): Paragraph[] {
  if (items.length === 0) return [];

  // Sort by y position (top to bottom), then x (left to right)
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const paragraphs: Paragraph[] = [];
  let currentLines: TextItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const prevItem = sorted[i - 1];
    const yGap = Math.abs(item.y - prevItem.y);
    const lineHeight = prevItem.fontSize * 1.4;

    if (yGap < lineHeight * 0.6) {
      // Same line
      currentLines[currentLines.length - 1].push(item);
    } else if (yGap < lineHeight * 1.8) {
      // New line in same paragraph
      currentLines.push([item]);
    } else {
      // New paragraph
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
  const text = lines.map(line => line.map(item => item.str).join(' ')).join('\n');
  const avgFontSize = allItems.reduce((sum, item) => sum + item.fontSize, 0) / allItems.length;
  const minX = Math.min(...allItems.map(item => item.x));
  const minY = Math.min(...allItems.map(item => item.y));

  return {
    text,
    y: minY,
    fontSize: Math.round(avgFontSize * 10) / 10,
    x: minX,
  };
}
