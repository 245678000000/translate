/**
 * Client-side text extraction for 20+ file formats.
 * PDF uses pdf.js (existing), office formats use mammoth/xlsx/jszip.
 */

type MammothModule = typeof import('mammoth');
type XlsxModule = typeof import('xlsx');
type JSZipModule = typeof import('jszip');
type JSZipInstance = InstanceType<JSZipModule['default']>;

let mammothPromise: Promise<MammothModule> | null = null;
let xlsxPromise: Promise<XlsxModule> | null = null;
let jszipPromise: Promise<JSZipModule> | null = null;

export interface ExtractionResult {
  text: string;
  pages?: number;
  format: string;
}

async function getMammoth(): Promise<MammothModule> {
  if (!mammothPromise) mammothPromise = import('mammoth');
  return mammothPromise;
}

async function getXlsx(): Promise<XlsxModule> {
  if (!xlsxPromise) xlsxPromise = import('xlsx');
  return xlsxPromise;
}

async function getJSZip(): Promise<JSZipModule['default']> {
  if (!jszipPromise) jszipPromise = import('jszip');
  const module = await jszipPromise;
  return module.default;
}

/**
 * Extract text from any supported file format.
 */
export async function extractTextFromAnyFile(file: File): Promise<ExtractionResult> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const format = ext.toUpperCase();

  // ── Plain text formats ──
  if (['txt', 'md', 'csv', 'json', 'rtf'].includes(ext)) {
    const text = await file.text();
    return { text, format };
  }

  // ── HTML ──
  if (['html', 'htm'].includes(ext)) {
    const raw = await file.text();
    const div = document.createElement('div');
    div.innerHTML = raw;
    div.querySelectorAll('script, style').forEach((el) => el.remove());
    const text = div.textContent || div.innerText || '';
    return { text: text.replace(/\s+/g, ' ').trim(), format: 'HTML' };
  }

  // ── DOCX (Word) ──
  if (ext === 'docx') {
    const mammoth = await getMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, format: 'DOCX' };
  }

  // ── DOC (legacy Word) — try as text, limited support ──
  if (ext === 'doc') {
    const arrayBuffer = await file.arrayBuffer();
    const text = extractTextFromBinary(arrayBuffer);
    if (text.length > 50) {
      return { text, format: 'DOC' };
    }
    throw new Error('.doc 格式支持有限，建议转换为 .docx 后重试');
  }

  // ── XLSX / XLS (Excel) ──
  if (['xlsx', 'xls'].includes(ext)) {
    const xlsx = await getXlsx();
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    const texts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet);
      texts.push(`[${sheetName}]\n${csv}`);
    }
    return { text: texts.join('\n\n'), pages: workbook.SheetNames.length, format: ext.toUpperCase() };
  }

  // ── PPTX (PowerPoint) ──
  if (ext === 'pptx') {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractPptxText(arrayBuffer);
    return { text, format: 'PPTX' };
  }

  // ── PPT (legacy PowerPoint) ──
  if (ext === 'ppt') {
    const arrayBuffer = await file.arrayBuffer();
    const text = extractTextFromBinary(arrayBuffer);
    if (text.length > 50) {
      return { text, format: 'PPT' };
    }
    throw new Error('.ppt 格式支持有限，建议转换为 .pptx 后重试');
  }

  // ── EPUB ──
  if (ext === 'epub') {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractEpubText(arrayBuffer);
    return { text, format: 'EPUB' };
  }

  // ── ODT (OpenDocument Text) ──
  if (ext === 'odt') {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractOdtText(arrayBuffer);
    return { text, format: 'ODT' };
  }

  // ── Images — no client-side OCR ──
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(ext)) {
    throw new Error('图片 OCR 识别功能即将上线。建议使用 Microsoft Translator 提供商（自动支持 OCR），或先将图片转为 PDF/TXT');
  }

  throw new Error(`不支持的文件格式: .${ext}。支持的格式：PDF、DOCX、XLSX、PPTX、TXT、MD、HTML、EPUB、ODT、CSV、JSON 等`);
}

/**
 * Extract text from PPTX by reading slide XML files inside the ZIP.
 */
async function extractPptxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideTexts: string[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
      return numA - numB;
    });

  for (const slidePath of slideFiles) {
    const entry = getZipEntry(zip, slidePath);
    if (!entry) continue;
    const xml = await entry.async('string');
    const texts = extractXmlTextContent(xml, 'a:t');
    if (texts) {
      const slideNum = slidePath.match(/slide(\d+)/)?.[1] || '?';
      slideTexts.push(`[Slide ${slideNum}]\n${texts}`);
    }
  }

  if (slideTexts.length === 0) {
    throw new Error('PPTX 文件中未找到文本内容');
  }

  return slideTexts.join('\n\n');
}

/**
 * Extract text from EPUB by reading XHTML content files inside the ZIP.
 */
async function extractEpubText(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const texts: string[] = [];

  const contentFiles = Object.keys(zip.files)
    .filter((name) => /\.(xhtml|html|htm|xml)$/.test(name) && !name.includes('META-INF') && !name.includes('content.opf'))
    .sort();

  for (const path of contentFiles) {
    const entry = getZipEntry(zip, path);
    if (!entry) continue;

    try {
      const content = await entry.async('string');
      const text = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 10) {
        texts.push(text);
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (texts.length === 0) {
    throw new Error('EPUB 文件中未找到文本内容');
  }

  return texts.join('\n\n');
}

/**
 * Extract text from ODT by reading content.xml inside the ZIP.
 */
async function extractOdtText(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const contentFile = getZipEntry(zip, 'content.xml');
  if (!contentFile) {
    throw new Error('ODT 文件格式异常：缺少 content.xml');
  }

  const xml = await contentFile.async('string');
  const text = xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    throw new Error('ODT 文件中未找到文本内容');
  }

  return text;
}

function getZipEntry(zip: JSZipInstance, path: string) {
  const entry = zip.files[path];
  if (!entry || entry.dir) return null;
  return entry;
}

/**
 * Simple XML text content extraction by tag name.
 */
function extractXmlTextContent(xml: string, tagName: string): string {
  const escapedTag = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${escapedTag}[^>]*>([^<]*)</${escapedTag}>`, 'g');
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1].trim()) {
      matches.push(match[1].trim());
    }
  }
  return matches.join(' ');
}

/**
 * Last-resort: extract readable ASCII/UTF strings from binary data.
 */
function extractTextFromBinary(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < bytes.length && i < 5_000_000; i++) {
    const byte = bytes[i];
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length > 4) {
        chunks.push(current);
      }
      current = '';
    }
  }
  if (current.length > 4) chunks.push(current);

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}
