import jsPDF from 'jspdf';

export interface TranslatedPage {
  pageNumber: number;
  originalText: string;
  translatedText: string;
}

export function exportTranslatedPDF(
  translatedPages: TranslatedPage[],
  originalFileName: string
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;

  translatedPages.forEach((page, index) => {
    if (index > 0) doc.addPage();

    let y = margin;

    // Page header
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Page ${page.pageNumber}`, margin, y);
    y += lineHeight * 2;

    // Translated content
    doc.setFontSize(11);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(page.translatedText, maxWidth);

    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  });

  const nameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
  doc.save(`${nameWithoutExt}_translated.pdf`);
}
