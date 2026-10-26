import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatbotService } from './chatbot.service';
import { RedisService } from '../../redis/redis.service';
import { LangchainService } from '../../langchain/langchain.service';
import { UploadDocumentDto } from '../../types/chatbot';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let mockWeaviateClient: any;
  let mockRedisService: any;
  let mockLangchainService: any;

  const mockDataCreator = {
    withClassName: jest.fn().mockReturnThis(),
    withProperties: jest.fn().mockReturnThis(),
    do: jest.fn(),
  };

  const mockSchemaCreator = {
    withClass: jest.fn().mockReturnThis(),
    do: jest.fn(),
  };

  const mockSchemaGetter = {
    withClassName: jest.fn().mockReturnThis(),
    do: jest.fn(),
  };

  const mockSchemaDeleter = {
    withClassName: jest.fn().mockReturnThis(),
    do: jest.fn(),
  };

  const mockGraphQLGet = {
    withClassName: jest.fn().mockReturnThis(),
    withFields: jest.fn().mockReturnThis(),
    withNearText: jest.fn().mockReturnThis(),
    withLimit: jest.fn().mockReturnThis(),
    withWhere: jest.fn().mockReturnThis(),
    do: jest.fn(),
  };

  const mockMetaGetter = {
    do: jest.fn().mockResolvedValue({ version: '1.0.0' }),
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock LangchainService
    mockLangchainService = {
      sendMessage: jest.fn().mockResolvedValue('LLM generated answer based on the documents.'),
    };

    // Create mock Redis service
    mockRedisService = {
      setSession: jest.fn().mockResolvedValue(true),
      getSession: jest.fn(),
      deleteSession: jest.fn().mockResolvedValue(true),
      getSessionsByPattern: jest.fn().mockResolvedValue([]),
    };

    // Create mock Weaviate client
    mockWeaviateClient = {
      data: {
        creator: jest.fn(() => mockDataCreator),
      },
      schema: {
        classCreator: jest.fn(() => mockSchemaCreator),
        classGetter: jest.fn(() => mockSchemaGetter),
        classDeleter: jest.fn(() => mockSchemaDeleter),
      },
      graphql: {
        get: jest.fn(() => mockGraphQLGet),
      },
      misc: {
        metaGetter: jest.fn(() => mockMetaGetter),
      },
    };

    // Mock weaviate-ts-client module
    jest.mock('weaviate-ts-client', () => ({
      default: {
        client: jest.fn(() => mockWeaviateClient),
      },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WEAVIATE_URL') return 'http://localhost:8080';
              return null;
            }),
          },
        },
        {
          provide: LangchainService,
          useValue: mockLangchainService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);

    // Manually set the client to our mock
    (service as any).client = mockWeaviateClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    it('should successfully upload a document with all fields', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Sample document content',
        title: 'Sample Title',
        category: 'technical',
        source: 'api',
      };
      const mockDocumentId = 'doc-123-abc';

      mockDataCreator.do.mockResolvedValue({ id: mockDocumentId });

      const result = await service.uploadDocument(uploadDto);

      expect(result).toEqual({
        id: mockDocumentId,
        message: 'Document uploaded successfully!',
      });
      expect(mockWeaviateClient.data.creator).toHaveBeenCalled();
      expect(mockDataCreator.withClassName).toHaveBeenCalledWith('ChatbotDocument');
      expect(mockDataCreator.withProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          content: uploadDto.content,
          title: uploadDto.title,
          category: uploadDto.category,
          source: uploadDto.source,
          timestamp: expect.any(String),
        }),
      );
    });

    it('should upload document with default values for optional fields', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Minimal content',
        title: 'Minimal Title',
      };
      const mockDocumentId = 'doc-456-def';

      mockDataCreator.do.mockResolvedValue({ id: mockDocumentId });

      const result = await service.uploadDocument(uploadDto);

      expect(result.id).toBe(mockDocumentId);
      expect(mockDataCreator.withProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          content: uploadDto.content,
          title: uploadDto.title,
          category: 'general',
          source: 'manual_upload',
        }),
      );
    });

    it('should return empty id when result id is missing', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Test content',
        title: 'Test Title',
      };

      mockDataCreator.do.mockResolvedValue({});

      const result = await service.uploadDocument(uploadDto);

      expect(result).toEqual({
        id: '',
        message: 'Document uploaded successfully!',
      });
    });

    it('should handle upload errors', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Error content',
        title: 'Error Title',
      };
      const error = new Error('Weaviate upload failed');

      mockDataCreator.do.mockRejectedValue(error);

      await expect(service.uploadDocument(uploadDto)).rejects.toThrow(error);
    });

    it('should include timestamp in uploaded document', async () => {
      const uploadDto: UploadDocumentDto = {
        content: 'Timestamp test',
        title: 'Timestamp Test',
      };

      mockDataCreator.do.mockResolvedValue({ id: 'doc-789' });

      await service.uploadDocument(uploadDto);

      const calledProperties = mockDataCreator.withProperties.mock.calls[0][0];
      expect(calledProperties.timestamp).toBeDefined();
      expect(new Date(calledProperties.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('askQuestion', () => {
    it('should successfully ask a question and return results', async () => {
      const question = 'What is the API documentation?';
      const mockDocuments = [
        {
          title: 'API Guide',
          content: 'API documentation content',
          category: 'technical',
          _additional: { distance: 0.1 },
        },
        {
          title: 'API Reference',
          content: 'API reference content',
          category: 'technical',
          _additional: { distance: 0.2 },
        },
      ];

      mockGraphQLGet.do.mockResolvedValue({
        data: {
          Get: {
            ChatbotDocument: mockDocuments,
          },
        },
      });

      const result = await service.askQuestion(question);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].title).toBe('API Guide');
      expect(result.sources[0].relevanceScore).toBe(0.1);
      expect(mockGraphQLGet.withClassName).toHaveBeenCalledWith('ChatbotDocument');
      expect(mockGraphQLGet.withNearText).toHaveBeenCalledWith({ concepts: [question] });
      expect(mockGraphQLGet.withLimit).toHaveBeenCalledWith(5);
    });

    it('should use custom limit parameter', async () => {
      const question = 'Test question';
      const limit = 10;

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      await service.askQuestion(question, limit);

      expect(mockGraphQLGet.withLimit).toHaveBeenCalledWith(limit);
    });

    it('should filter by category when provided', async () => {
      const question = 'Category test';
      const category = 'faq';

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      await service.askQuestion(question, 5, category);

      expect(mockGraphQLGet.withWhere).toHaveBeenCalledWith({
        path: ['category'],
        operator: 'Equal',
        valueText: category,
      });
    });

    it('should not filter when category is not provided', async () => {
      const question = 'No category test';

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      await service.askQuestion(question, 5);

      expect(mockGraphQLGet.withWhere).not.toHaveBeenCalled();
    });

    it('should return default message when no documents found', async () => {
      const question = 'Unknown topic';

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      const result = await service.askQuestion(question);

      expect(result.answer).toBe(
        "I don't have enough information in my knowledge base to answer that question.",
      );
      expect(result.sources).toHaveLength(0);
    });

    it('should handle errors gracefully during document search', async () => {
      const question = 'Error test';
      const error = new Error('Query failed');

      mockGraphQLGet.do.mockRejectedValue(error);

      const result = await service.askQuestion(question);

      // The service catches errors in findRelevantDocuments and returns empty array
      expect(result.sources).toHaveLength(0);
      expect(result.answer).toContain("don't have enough information");
    });

    it('should generate answer with multiple sources', async () => {
      const question = 'Multi-source question';
      const mockDocuments = [
        {
          title: 'Doc 1',
          content: 'Content 1',
          category: 'test',
          _additional: { distance: 0.1 },
        },
        {
          title: 'Doc 2',
          content: 'Content 2',
          category: 'test',
          _additional: { distance: 0.2 },
        },
        {
          title: 'Doc 3',
          content: 'Content 3',
          category: 'test',
          _additional: { distance: 0.3 },
        },
      ];

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: mockDocuments } },
      });

      const result = await service.askQuestion(question);

      expect(result.sources).toHaveLength(3);
      expect(result.answer).toBe('LLM generated answer based on the documents.');
      expect(mockLangchainService.sendMessage).toHaveBeenCalledWith(
        question,
        expect.stringContaining('[Source 1: Doc 1]'),
      );
    });

    it('should handle missing _additional field in documents', async () => {
      const question = 'Test question';
      const mockDocuments = [
        {
          title: 'Doc without additional',
          content: 'Content',
          category: 'test',
        },
      ];

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: mockDocuments } },
      });

      const result = await service.askQuestion(question);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].relevanceScore).toBeUndefined();
    });

    it('should handle null or undefined document list', async () => {
      const question = 'Null test';

      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: null } },
      });

      const result = await service.askQuestion(question);

      expect(result.sources).toHaveLength(0);
      expect(result.answer).toContain("don't have enough information");
    });
  });

  describe('deleteAllDocuments', () => {
    it('should successfully delete all documents and recreate schema', async () => {
      mockSchemaDeleter.do.mockResolvedValue(undefined);
      mockSchemaGetter.do.mockRejectedValue(new Error('Class not found'));
      mockSchemaCreator.do.mockResolvedValue(undefined);

      await service.deleteAllDocuments();

      expect(mockWeaviateClient.schema.classDeleter).toHaveBeenCalled();
      expect(mockSchemaDeleter.withClassName).toHaveBeenCalledWith('ChatbotDocument');
      expect(mockSchemaDeleter.do).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Failed to delete class');
      mockSchemaDeleter.do.mockRejectedValue(error);

      await expect(service.deleteAllDocuments()).rejects.toThrow(error);
    });

    it('should recreate schema after deletion', async () => {
      mockSchemaDeleter.do.mockResolvedValue(undefined);
      mockSchemaGetter.do.mockRejectedValue(new Error('Class not found'));
      mockSchemaCreator.do.mockResolvedValue(undefined);

      await service.deleteAllDocuments();

      expect(mockSchemaDeleter.do).toHaveBeenCalled();
      // After deletion, createSchema is called which would check if schema exists
      expect(mockWeaviateClient.schema.classGetter).toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('should return the Weaviate client instance', () => {
      const client = service.getClient();

      expect(client).toBeDefined();
      expect(client).toBe(mockWeaviateClient);
    });

    it('should return the same client instance on multiple calls', () => {
      const client1 = service.getClient();
      const client2 = service.getClient();

      expect(client1).toBe(client2);
    });
  });

  describe('service instance', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have uploadDocument method', () => {
      expect(service.uploadDocument).toBeDefined();
      expect(typeof service.uploadDocument).toBe('function');
    });

    it('should have askQuestion method', () => {
      expect(service.askQuestion).toBeDefined();
      expect(typeof service.askQuestion).toBe('function');
    });

    it('should have deleteAllDocuments method', () => {
      expect(service.deleteAllDocuments).toBeDefined();
      expect(typeof service.deleteAllDocuments).toBe('function');
    });

    it('should have getClient method', () => {
      expect(service.getClient).toBeDefined();
      expect(typeof service.getClient).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle empty question string', async () => {
      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      const result = await service.askQuestion('');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
    });

    it('should handle very long content in documents', async () => {
      const longContent = 'x'.repeat(10000);
      const uploadDto: UploadDocumentDto = {
        content: longContent,
        title: 'Long Document',
      };

      mockDataCreator.do.mockResolvedValue({ id: 'long-doc-id' });

      const result = await service.uploadDocument(uploadDto);

      expect(result.id).toBe('long-doc-id');
      expect(mockDataCreator.withProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          content: longContent,
        }),
      );
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Test with special chars: @#$%^&*()[]{}|\\";:<>?,./';
      const uploadDto: UploadDocumentDto = {
        content: specialContent,
        title: 'Special Chars',
      };

      mockDataCreator.do.mockResolvedValue({ id: 'special-id' });

      const result = await service.uploadDocument(uploadDto);

      expect(result.id).toBe('special-id');
    });

    it('should handle limit boundary values', async () => {
      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      await service.askQuestion('Test', 1);
      expect(mockGraphQLGet.withLimit).toHaveBeenCalledWith(1);

      await service.askQuestion('Test', 100);
      expect(mockGraphQLGet.withLimit).toHaveBeenCalledWith(100);
    });
  });

  // ========== Chat History Tests ==========

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const result = await service.createSession();

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('Chat session created successfully');
      expect(mockRedisService.setSession).toHaveBeenCalled();
    });

    it('should create session with userId', async () => {
      const userId = 'user-123';
      const result = await service.createSession(userId);

      expect(result.sessionUUID).toBeDefined();
      const setSessionCall = mockRedisService.setSession.mock.calls[0];
      const sessionData = JSON.parse(setSessionCall[1]);
      expect(sessionData.userId).toBe(userId);
    });

    it('should generate unique session IDs', async () => {
      const result1 = await service.createSession();
      const result2 = await service.createSession();

      expect(result1.sessionUUID).not.toBe(result2.sessionUUID);
    });
  });

  describe('getSessionHistory', () => {
    it('should retrieve session history successfully', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-1',
        messages: [
          { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00.000Z' },
          { role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T00:00:01.000Z' },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:01.000Z',
      };

      mockRedisService.getSession.mockResolvedValue(JSON.stringify(mockSession));

      const result = await service.getSessionHistory('session-123');

      expect(result.sessionUUID).toBe('session-123');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
    });

    it('should throw error when session not found', async () => {
      mockRedisService.getSession.mockResolvedValue(null);

      await expect(service.getSessionHistory('non-existent')).rejects.toThrow(
        'Session not found: non-existent',
      );
    });
  });

  describe('askQuestionWithHistory', () => {
    it('should ask question and store in history', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-1',
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockRedisService.getSession.mockResolvedValue(JSON.stringify(mockSession));
      mockGraphQLGet.do.mockResolvedValue({
        data: {
          Get: {
            ChatbotDocument: [
              {
                title: 'Test Doc',
                content: 'Test content',
                category: 'test',
                _additional: { distance: 0.1 },
              },
            ],
          },
        },
      });

      const result = await service.askQuestionWithHistory('session-123', 'What is this?');

      expect(result.sessionUUID).toBe('session-123');
      expect(result.answer).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(result.conversationHistory).toHaveLength(2);
      expect(result.conversationHistory[0].role).toBe('user');
      expect(result.conversationHistory[1].role).toBe('assistant');
      expect(mockRedisService.setSession).toHaveBeenCalled();
    });

    it('should throw error when session not found', async () => {
      mockRedisService.getSession.mockResolvedValue(null);

      await expect(
        service.askQuestionWithHistory('non-existent', 'Question'),
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should pass conversation history to LLM for context', async () => {
      const existingMessages = [
        { role: 'user', content: 'What is platform role?', timestamp: '2024-01-01T00:00:00.000Z' },
        { role: 'assistant', content: 'Platform role is...', timestamp: '2024-01-01T00:00:01.000Z' },
      ];
      const mockSession = {
        sessionId: 'session-123',
        messages: [...existingMessages],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:01.000Z',
      };

      mockRedisService.getSession.mockResolvedValue(JSON.stringify(mockSession));
      mockGraphQLGet.do.mockResolvedValue({
        data: {
          Get: {
            ChatbotDocument: [
              { title: 'Doc', content: 'Content', category: 'test', _additional: { distance: 0.1 } },
            ],
          },
        },
      });

      await service.askQuestionWithHistory('session-123', 'Tell me more about it');

      expect(mockLangchainService.sendMessage).toHaveBeenCalledWith(
        'Tell me more about it',
        expect.stringContaining('Conversation history:'),
      );
      expect(mockLangchainService.sendMessage).toHaveBeenCalledWith(
        'Tell me more about it',
        expect.stringContaining('user: What is platform role?'),
      );
      expect(mockLangchainService.sendMessage).toHaveBeenCalledWith(
        'Tell me more about it',
        expect.stringContaining('assistant: Platform role is...'),
      );
    });

    it('should preserve existing messages in history', async () => {
      const existingMessages = [
        { role: 'user', content: 'Previous question', timestamp: '2024-01-01T00:00:00.000Z' },
        { role: 'assistant', content: 'Previous answer', timestamp: '2024-01-01T00:00:01.000Z' },
      ];
      const mockSession = {
        sessionId: 'session-123',
        messages: existingMessages,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:01.000Z',
      };

      mockRedisService.getSession.mockResolvedValue(JSON.stringify(mockSession));
      mockGraphQLGet.do.mockResolvedValue({
        data: { Get: { ChatbotDocument: [] } },
      });

      const result = await service.askQuestionWithHistory('session-123', 'New question');

      expect(result.conversationHistory).toHaveLength(4);
      expect(result.conversationHistory[0].content).toBe('Previous question');
      expect(result.conversationHistory[2].content).toBe('New question');
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      await service.deleteSession('session-123');

      expect(mockRedisService.deleteSession).toHaveBeenCalledWith(
        'chatbot_session:session-123',
      );
    });
  });

  describe('getAllUserSessions', () => {
    it('should retrieve all sessions for a user', async () => {
      const sessions = [
        JSON.stringify({
          sessionId: 'session-1',
          userId: 'user-123',
          messages: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
        JSON.stringify({
          sessionId: 'session-2',
          userId: 'user-123',
          messages: [],
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
        JSON.stringify({
          sessionId: 'session-3',
          userId: 'other-user',
          messages: [],
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        }),
      ];

      mockRedisService.getSessionsByPattern.mockResolvedValue(sessions);

      const result = await service.getAllUserSessions('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].customerUUID).toBe('user-123');
      expect(result[1].customerUUID).toBe('user-123');
    });

    it('should return empty array when no sessions exist', async () => {
      mockRedisService.getSessionsByPattern.mockResolvedValue([]);

      const result = await service.getAllUserSessions('user-with-no-sessions');

      expect(result).toHaveLength(0);
    });
  });
});
