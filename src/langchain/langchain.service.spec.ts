import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LangchainService } from './langchain.service';

describe('LangchainService', () => {
  let service: LangchainService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangchainService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_API_KEY') {
                return 'test-api-key';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LangchainService>(LangchainService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error if GOOGLE_API_KEY is missing', () => {
    const mockConfigService = {
      get: jest.fn(() => undefined),
    };

    expect(() => {
      new LangchainService(
        mockConfigService as unknown as ConfigService,
      );
    }).toThrow('LangChain service is not properly configured: GOOGLE_API_KEY is required');
  });
});
