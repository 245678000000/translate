import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PDFPageContent {
  pageNumber: number;
  text: string;
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
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push({ pageNumber: i, text });
  }

  return {
    fileName: file.name,
    numPages: pdf.numPages,
    pages,
  };
}
