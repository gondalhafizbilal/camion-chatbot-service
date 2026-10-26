import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

// Mock redis client
const mockRedisClient = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  mGet: jest.fn(),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('RedisService', () => {
  let service: RedisService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    try {
      await service.onModuleDestroy();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('onModuleInit', () => {
    it('should initialize Redis client with default host and port', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should initialize with password when provided', async () => {
      const passwordConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, any> = {
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_PASSWORD: 'secure-password',
          };
          return config[key];
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedisService,
          {
            provide: ConfigService,
            useValue: passwordConfigService,
          },
        ],
      }).compile();

      const customService = module.get<RedisService>(RedisService);
      mockRedisClient.connect.mockResolvedValue(undefined);

      await customService.onModuleInit();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should throw error when connection fails', async () => {
      const connectionError = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(connectionError);

      await expect(service.onModuleInit()).rejects.toThrow(connectionError);
    });

    it('should register error and connect event listeners', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis connection', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.quit.mockResolvedValue(undefined);

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('setSession', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should set session value with default expiration', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await service.setSession('session:123', '{"data":"test"}');

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:123',
        86400,
        '{"data":"test"}',
      );
    });

    it('should set session value with custom expiration', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await service.setSession('session:123', '{"data":"test"}', 3600);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:123',
        3600,
        '{"data":"test"}',
      );
    });

    it('should return false when set fails', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Set failed'));

      const result = await service.setSession('session:123', '{"data":"test"}');

      expect(result).toBe(false);
    });
  });

  describe('getSession', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should retrieve session value', async () => {
      mockRedisClient.get.mockResolvedValue('{"data":"test"}');

      const result = await service.getSession('session:123');

      expect(result).toBe('{"data":"test"}');
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:123');
    });

    it('should return null when session does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getSession('session:nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.getSession('session:123');

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should delete session and return true', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.deleteSession('session:123');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('session:123');
    });

    it('should return false when session does not exist', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await service.deleteSession('session:nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Delete failed'));

      const result = await service.deleteSession('session:123');

      expect(result).toBe(false);
    });
  });

  describe('getSessionsByPattern', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should return sessions matching pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['session:1', 'session:2']);
      mockRedisClient.mGet.mockResolvedValue(['{"id":"1"}', '{"id":"2"}']);

      const result = await service.getSessionsByPattern('session:*');

      expect(result).toEqual(['{"id":"1"}', '{"id":"2"}']);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('session:*');
    });

    it('should return empty array when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await service.getSessionsByPattern('nonexistent:*');

      expect(result).toEqual([]);
      expect(mockRedisClient.mGet).not.toHaveBeenCalled();
    });

    it('should filter out null values', async () => {
      mockRedisClient.keys.mockResolvedValue(['session:1', 'session:2']);
      mockRedisClient.mGet.mockResolvedValue(['{"id":"1"}', null]);

      const result = await service.getSessionsByPattern('session:*');

      expect(result).toEqual(['{"id":"1"}']);
    });

    it('should return empty array on error', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.getSessionsByPattern('session:*');

      expect(result).toEqual([]);
    });
  });
});
