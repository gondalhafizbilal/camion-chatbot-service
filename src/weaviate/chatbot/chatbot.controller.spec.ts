import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { FileParserService } from './file-parser.service';
import {
  UploadDocumentDto,
  AskQuestionDto,
  CreateSessionDto,
} from '../../types/chatbot';

describe('ChatbotController', () => {
  let controller: ChatbotController;
  let service: ChatbotService;
  let fileParserService: FileParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [
        {
          provide: ChatbotService,
          useValue: {
            uploadDocument: jest.fn(),
            askQuestion: jest.fn(),
            deleteAllDocuments: jest.fn(),
            createSession: jest.fn(),
            getSessionHistory: jest.fn(),
            askQuestionWithHistory: jest.fn(),
            deleteSession: jest.fn(),
            getAllUserSessions: jest.fn(),
          },
        },
        {
          provide: FileParserService,
          useValue: {
            extractText: jest.fn(),
            validateFile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatbotController>(ChatbotController);
    service = module.get<ChatbotService>(ChatbotService);
    fileParserService = module.get<FileParserService>(FileParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    it('should successfully upload a document with all fields', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'This is sample content',
        title: 'Sample Document',
        category: 'technical',
        source: 'api',
      };
      const expectedResponse = {
        id: 'test-id-123',
        message: 'Document uploaded successfully!',
      };

      (service.uploadDocument as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(uploadDto);

      expect(result).toEqual(expectedResponse);
      expect(service.uploadDocument).toHaveBeenCalledWith(uploadDto);
      expect(service.uploadDocument).toHaveBeenCalledTimes(1);
    });

    it('should upload document with only required fields', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Minimal content',
        title: 'Minimal Title',
      };
      const expectedResponse = {
        id: 'test-id-456',
        message: 'Document uploaded successfully!',
      };

      (service.uploadDocument as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(uploadDto);

      expect(result).toEqual(expectedResponse);
      expect(service.uploadDocument).toHaveBeenCalledWith(uploadDto);
    });

    it('should upload document with category but no source', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Content with category',
        title: 'Categorized Document',
        category: 'faq',
      };
      const expectedResponse = {
        id: 'test-id-789',
        message: 'Document uploaded successfully!',
      };

      (service.uploadDocument as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(uploadDto);

      expect(result).toEqual(expectedResponse);
      expect(service.uploadDocument).toHaveBeenCalledWith(uploadDto);
    });

    it('should propagate service errors', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Error test content',
        title: 'Error Test',
      };
      const error = new Error('Weaviate connection failed');

      (service.uploadDocument as jest.Mock).mockRejectedValue(error);

      await expect(controller.uploadDocument(uploadDto)).rejects.toThrow(error);
      expect(service.uploadDocument).toHaveBeenCalledWith(uploadDto);
    });

    it('should return correct response structure', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Test content',
        title: 'Test Title',
      };
      const expectedResponse = {
        id: 'doc-id',
        message: 'Document uploaded successfully!',
      };

      (service.uploadDocument as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(uploadDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('message');
      expect(typeof result.id).toBe('string');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('askQuestion', () => {
    it('should successfully ask a question with all parameters', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'What is the meaning of life?',
        limit: 10,
        category: 'philosophy',
      };
      const expectedResponse = {
        answer: 'Based on available documents...',
        sources: [
          {
            title: 'Philosophy 101',
            content: 'The meaning of life...',
            category: 'philosophy',
            relevanceScore: 0.95,
          },
        ],
      };

      (service.askQuestion as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askQuestion(askQuestionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.askQuestion).toHaveBeenCalledWith(
        'What is the meaning of life?',
        10,
        'philosophy',
      );
      expect(service.askQuestion).toHaveBeenCalledTimes(1);
    });

    it('should use default limit of 5 when limit is not provided', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'How does this work?',
      };
      const expectedResponse = {
        answer: 'Answer based on documents',
        sources: [],
      };

      (service.askQuestion as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askQuestion(askQuestionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.askQuestion).toHaveBeenCalledWith(
        'How does this work?',
        5,
        undefined,
      );
    });

    it('should ask question with category but no limit', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'What are the features?',
        category: 'technical',
      };
      const expectedResponse = {
        answer: 'Features include...',
        sources: [
          {
            title: 'Feature List',
            content: 'Feature 1, Feature 2',
            category: 'technical',
          },
        ],
      };

      (service.askQuestion as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askQuestion(askQuestionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.askQuestion).toHaveBeenCalledWith(
        'What are the features?',
        5,
        'technical',
      );
    });

    it('should ask question with custom limit', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'Tell me about API',
        limit: 3,
      };
      const expectedResponse = {
        answer: 'API information...',
        sources: [
          { title: 'API Doc 1', content: 'Content 1' },
          { title: 'API Doc 2', content: 'Content 2' },
          { title: 'API Doc 3', content: 'Content 3' },
        ],
      };

      (service.askQuestion as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askQuestion(askQuestionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.askQuestion).toHaveBeenCalledWith('Tell me about API', 3, undefined);
    });

    it('should return empty sources when no relevant documents found', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'Non-existent topic',
      };
      const expectedResponse = {
        answer: "I don't have enough information in my knowledge base to answer that question.",
        sources: [],
      };

      (service.askQuestion as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askQuestion(askQuestionDto);

      expect(result.sources).toHaveLength(0);
      expect(result.answer).toContain("don't have enough information");
    });

    it('should propagate service errors', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'Error test',
      };
      const error = new Error('Query execution failed');

      (service.askQuestion as jest.Mock).mockRejectedValue(error);

      await expect(controller.askQuestion(askQuestionDto)).rejects.toThrow(error);
      expect(service.askQuestion).toHaveBeenCalledWith('Error test', 5, undefined);
    });

    it('should return correct response structure', async () => {
      const askQuestionDto: AskQuestionDto = {
        question: 'Test question',
      };
      const expectedResponse = {
        answer: 'Test answer',
        sources: [
          {
            title: 'Test Source',
            content: 'Test Content',
            category: 'test',
            relevanceScore: 0.9,
          },
        ],
      };

      (service.askQuestion as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askQuestion(askQuestionDto);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
      expect(Array.isArray(result.sources)).toBe(true);
      expect(typeof result.answer).toBe('string');
    });
  });

  describe('deleteAllDocuments', () => {
    it('should successfully delete all documents', async () => {
      (service.deleteAllDocuments as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.deleteAllDocuments();

      expect(result).toBeUndefined();
      expect(service.deleteAllDocuments).toHaveBeenCalledTimes(1);
      expect(service.deleteAllDocuments).toHaveBeenCalledWith();
    });

    it('should propagate service errors', async () => {
      const error = new Error('Failed to delete schema');

      (service.deleteAllDocuments as jest.Mock).mockRejectedValue(error);

      await expect(controller.deleteAllDocuments()).rejects.toThrow(error);
      expect(service.deleteAllDocuments).toHaveBeenCalledTimes(1);
    });

    it('should handle deletion and re-creation flow', async () => {
      (service.deleteAllDocuments as jest.Mock).mockResolvedValue(undefined);

      await controller.deleteAllDocuments();

      expect(service.deleteAllDocuments).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadFile', () => {
    const mockFile = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('fake pdf content'),
    } as Express.Multer.File;

    it('should upload a PDF file successfully', async () => {
      const extractedText = 'Extracted PDF content';
      (fileParserService.extractText as jest.Mock).mockResolvedValue(extractedText);
      (service.uploadDocument as jest.Mock).mockResolvedValue({
        id: 'doc-123',
        message: 'Document uploaded successfully!',
      });

      const result = await controller.uploadFile(mockFile, {});

      expect(fileParserService.extractText).toHaveBeenCalledWith(mockFile);
      expect(service.uploadDocument).toHaveBeenCalledWith({
        content: extractedText,
        title: 'test.pdf',
        category: undefined,
        source: 'file_upload',
      });
      expect(result.id).toBe('doc-123');
    });

    it('should use provided title instead of filename', async () => {
      (fileParserService.extractText as jest.Mock).mockResolvedValue('text');
      (service.uploadDocument as jest.Mock).mockResolvedValue({
        id: 'doc-456',
        message: 'Document uploaded successfully!',
      });

      await controller.uploadFile(mockFile, { title: 'Custom Title' });

      expect(service.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Custom Title' }),
      );
    });

    it('should use provided category and source', async () => {
      (fileParserService.extractText as jest.Mock).mockResolvedValue('text');
      (service.uploadDocument as jest.Mock).mockResolvedValue({
        id: 'doc-789',
        message: 'Document uploaded successfully!',
      });

      await controller.uploadFile(mockFile, {
        title: 'My Doc',
        category: 'technical',
        source: 'api',
      });

      expect(service.uploadDocument).toHaveBeenCalledWith({
        content: 'text',
        title: 'My Doc',
        category: 'technical',
        source: 'api',
      });
    });

    it('should throw BadRequestException when no file provided', async () => {
      await expect(
        controller.uploadFile(undefined as any, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate file parsing errors', async () => {
      const error = new BadRequestException('Unsupported file type');
      (fileParserService.extractText as jest.Mock).mockRejectedValue(error);

      await expect(controller.uploadFile(mockFile, {})).rejects.toThrow(error);
    });
  });

  describe('controller instance', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have uploadDocument method', () => {
      expect(controller.uploadDocument).toBeDefined();
      expect(typeof controller.uploadDocument).toBe('function');
    });

    it('should have askQuestion method', () => {
      expect(controller.askQuestion).toBeDefined();
      expect(typeof controller.askQuestion).toBe('function');
    });

    it('should have deleteAllDocuments method', () => {
      expect(controller.deleteAllDocuments).toBeDefined();
      expect(typeof controller.deleteAllDocuments).toBe('function');
    });

    it('should have createSession method', () => {
      expect(controller.createSession).toBeDefined();
      expect(typeof controller.createSession).toBe('function');
    });

    it('should have getSessionHistory method', () => {
      expect(controller.getSessionHistory).toBeDefined();
      expect(typeof controller.getSessionHistory).toBe('function');
    });

    it('should have askWithHistory method', () => {
      expect(controller.askWithHistory).toBeDefined();
      expect(typeof controller.askWithHistory).toBe('function');
    });

    it('should have deleteSession method', () => {
      expect(controller.deleteSession).toBeDefined();
      expect(typeof controller.deleteSession).toBe('function');
    });

    it('should have getUserSessions method', () => {
      expect(controller.getUserSessions).toBeDefined();
      expect(typeof controller.getUserSessions).toBe('function');
    });
  });

  // ========== Chat History Endpoint Tests ==========

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const createSessionDto: CreateSessionDto = { token: 'user-123' };
      const expectedResponse = {
        sessionId: 'session-abc-123',
        message: 'Chat session created successfully',
      };

      (service.createSession as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.createSession(createSessionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.createSession).toHaveBeenCalledWith('user-123');
    });

    it('should create session without userId', async () => {
      const createSessionDto: CreateSessionDto = {};
      const expectedResponse = {
        sessionId: 'session-def-456',
        message: 'Chat session created successfully',
      };

      (service.createSession as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.createSession(createSessionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.createSession).toHaveBeenCalledWith(undefined);
    });

    it('should propagate service errors', async () => {
      const createSessionDto: CreateSessionDto = { token: 'user-123' };
      const error = new Error('Redis connection failed');

      (service.createSession as jest.Mock).mockRejectedValue(error);

      await expect(controller.createSession(createSessionDto)).rejects.toThrow(error);
    });
  });

  describe('getSessionHistory', () => {
    it('should retrieve session history successfully', async () => {
      const sessionId = 'session-123';
      const expectedResponse = {
        sessionId,
        messages: [
          { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00.000Z' },
          { role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T00:00:01.000Z' },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:01.000Z',
      };

      (service.getSessionHistory as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.getSessionHistory(sessionId);

      expect(result).toEqual(expectedResponse);
      expect(service.getSessionHistory).toHaveBeenCalledWith(sessionId);
    });

    it('should propagate errors for non-existent session', async () => {
      const sessionId = 'non-existent';
      const error = new Error('Session not found: non-existent');

      (service.getSessionHistory as jest.Mock).mockRejectedValue(error);

      await expect(controller.getSessionHistory(sessionId)).rejects.toThrow(error);
    });
  });

  describe('askWithHistory', () => {
    it('should ask question with session and return history', async () => {
      const sessionId = 'session-123';
      const askQuestionDto: AskQuestionDto = {
        question: 'What is AI?',
        limit: 5,
        category: 'tech',
      };
      const expectedResponse = {
        sessionId,
        answer: 'AI is artificial intelligence...',
        sources: [{ title: 'AI Guide', content: 'AI content' }],
        conversationHistory: [
          { role: 'user', content: 'What is AI?', timestamp: '2024-01-01T00:00:00.000Z' },
          { role: 'assistant', content: 'AI is artificial intelligence...', timestamp: '2024-01-01T00:00:01.000Z' },
        ],
      };

      (service.askQuestionWithHistory as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.askWithHistory(sessionId, askQuestionDto);

      expect(result).toEqual(expectedResponse);
      expect(service.askQuestionWithHistory).toHaveBeenCalledWith(
        sessionId,
        'What is AI?',
        5,
        'tech',
      );
    });

    it('should use default limit when not provided', async () => {
      const sessionId = 'session-123';
      const askQuestionDto: AskQuestionDto = {
        question: 'Test question',
      };
      const expectedResponse = {
        sessionId,
        answer: 'Test answer',
        sources: [],
        conversationHistory: [],
      };

      (service.askQuestionWithHistory as jest.Mock).mockResolvedValue(expectedResponse);

      await controller.askWithHistory(sessionId, askQuestionDto);

      expect(service.askQuestionWithHistory).toHaveBeenCalledWith(
        sessionId,
        'Test question',
        5,
        undefined,
      );
    });

    it('should propagate service errors', async () => {
      const sessionId = 'non-existent';
      const askQuestionDto: AskQuestionDto = { question: 'Test' };
      const error = new Error('Session not found');

      (service.askQuestionWithHistory as jest.Mock).mockRejectedValue(error);

      await expect(controller.askWithHistory(sessionId, askQuestionDto)).rejects.toThrow(error);
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      const sessionId = 'session-123';

      (service.deleteSession as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.deleteSession(sessionId);

      expect(result).toBeUndefined();
      expect(service.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    it('should propagate service errors', async () => {
      const sessionId = 'session-123';
      const error = new Error('Failed to delete session');

      (service.deleteSession as jest.Mock).mockRejectedValue(error);

      await expect(controller.deleteSession(sessionId)).rejects.toThrow(error);
    });
  });

  describe('getUserSessions', () => {
    it('should retrieve all sessions for a user', async () => {
      const userId = 'user-123';
      const expectedResponse = [
        {
          sessionId: 'session-1',
          userId,
          messages: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          sessionId: 'session-2',
          userId,
          messages: [],
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      (service.getAllUserSessions as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.getUserSessions(userId);

      expect(result).toEqual(expectedResponse);
      expect(service.getAllUserSessions).toHaveBeenCalledWith(userId);
    });

    it('should return empty array when user has no sessions', async () => {
      const userId = 'user-with-no-sessions';

      (service.getAllUserSessions as jest.Mock).mockResolvedValue([]);

      const result = await controller.getUserSessions(userId);

      expect(result).toHaveLength(0);
      expect(service.getAllUserSessions).toHaveBeenCalledWith(userId);
    });

    it('should propagate service errors', async () => {
      const userId = 'user-123';
      const error = new Error('Redis error');

      (service.getAllUserSessions as jest.Mock).mockRejectedValue(error);

      await expect(controller.getUserSessions(userId)).rejects.toThrow(error);
    });
  });
});
