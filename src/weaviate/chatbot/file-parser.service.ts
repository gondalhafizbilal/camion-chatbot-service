import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain';

const ALLOWED_MIME_TYPES: SupportedMimeType[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as SupportedMimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, TXT`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${file.size} bytes. Maximum: ${MAX_FILE_SIZE} bytes`,
      );
    }
  }

  async extractText(file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    switch (file.mimetype) {
      case 'application/pdf':
        return this.extractFromPdf(file.buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDocx(file.buffer);
      case 'text/plain':
        return file.buffer.toString('utf-8');
      default:
        throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
      const result = await parser.getText({ pageJoiner: '\n' });
      const text = result.text.trim();
      if (!text) {
        throw new BadRequestException('PDF file contains no extractable text');
      }
      return text;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Failed to parse PDF', error);
      throw new BadRequestException(
        'Failed to parse PDF file. It may be corrupt or encrypted.',
      );
    } finally {
      await parser?.destroy();
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) {
        throw new BadRequestException('DOCX file contains no extractable text');
      }
      return text;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Failed to parse DOCX', error);
      throw new BadRequestException(
        'Failed to parse DOCX file. It may be corrupt.',
      );
    }
  }
}
