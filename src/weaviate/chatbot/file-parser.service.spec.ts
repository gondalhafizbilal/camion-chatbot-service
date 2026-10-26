import { BadRequestException } from '@nestjs/common';
import { FileParserService } from './file-parser.service';

describe('FileParserService', () => {
  let service: FileParserService;

  beforeEach(() => {
    service = new FileParserService();
  });

  describe('validateFile', () => {
    it('should reject unsupported mime types', () => {
      const file = {
        mimetype: 'image/png',
        size: 100,
      } as Express.Multer.File;
      expect(() => service.validateFile(file)).toThrow(BadRequestException);
    });

    it('should reject files exceeding size limit', () => {
      const file = {
        mimetype: 'text/plain',
        size: 11 * 1024 * 1024,
      } as Express.Multer.File;
      expect(() => service.validateFile(file)).toThrow(BadRequestException);
    });

    it('should accept valid TXT file', () => {
      const file = {
        mimetype: 'text/plain',
        size: 1000,
      } as Express.Multer.File;
      expect(() => service.validateFile(file)).not.toThrow();
    });

    it('should accept valid PDF file', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 1000,
      } as Express.Multer.File;
      expect(() => service.validateFile(file)).not.toThrow();
    });

    it('should accept valid DOCX file', () => {
      const file = {
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1000,
      } as Express.Multer.File;
      expect(() => service.validateFile(file)).not.toThrow();
    });
  });

  describe('extractText', () => {
    it('should extract text from TXT file', async () => {
      const file = {
        mimetype: 'text/plain',
        size: 11,
        buffer: Buffer.from('Hello World'),
      } as Express.Multer.File;
      const text = await service.extractText(file);
      expect(text).toBe('Hello World');
    });

    it('should throw on corrupt PDF', async () => {
      const file = {
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('not a pdf'),
      } as Express.Multer.File;
      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on corrupt DOCX', async () => {
      const file = {
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 100,
        buffer: Buffer.from('not a docx'),
      } as Express.Multer.File;
      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on unsupported mime type', async () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('data'),
      } as Express.Multer.File;
      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
