declare module 'pdf-parse' {
  import { Buffer } from 'node:buffer';
  interface PdfParseData {
    text: string;
    numpages: number;
    metadata: any;
  }
  export default function pdfParse(buffer: Buffer | Uint8Array): Promise<PdfParseData>;
} 