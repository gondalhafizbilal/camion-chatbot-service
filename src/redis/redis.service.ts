import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RedisService.name);
	private redisClient: RedisClientType;

	constructor(private configService: ConfigService) {
	}

	async onModuleInit() {
		this.redisClient = createClient({
			url: this.configService.get<string>('REDIS_URI'),
		});

		this.redisClient.on('error', (err) => {
			this.logger.error('Redis Client Error', err);
		});

		this.redisClient.on('connect', () => {
			this.logger.log('Connected to Redis');
		});

		try {
			await this.redisClient.connect();
		} catch (error) {
			this.logger.error('Failed to connect to Redis', error);
			throw error;
		}
	}

	async onModuleDestroy() {
		if (this.redisClient) {
			await this.redisClient.quit();
			this.logger.log('Disconnected from Redis');
		}
	}

	async setSession(
		key: string,
		value: string,
		expirationSeconds: number = 86400,
	): Promise<boolean> {
		try {
			await this.redisClient.setEx(key, expirationSeconds, value);
			return true;
		} catch (error) {
			this.logger.error('Error setting session in Redis', error);
			return false;
		}
	}

	async getSession(key: string): Promise<string | null> {
		try {
			return await this.redisClient.get(key);
		} catch (error) {
			this.logger.error('Error getting session from Redis', error);
			return null;
		}
	}

	async deleteSession(key: string): Promise<boolean> {
		try {
			const result = await this.redisClient.del(key);
			return result === 1;
		} catch (error) {
			this.logger.error('Error deleting session from Redis', error);
			return false;
		}
	}

	async getSessionsByPattern(pattern: string): Promise<string[]> {
		try {
			const keys = await this.redisClient.keys(pattern);
			if (keys.length === 0) {
				return [];
			}
			const values = await this.redisClient.mGet(keys);
			return values.filter((v): v is string => v !== null);
		} catch (error) {
			this.logger.error('Error getting sessions by pattern from Redis', error);
			return [];
		}
	}
}
