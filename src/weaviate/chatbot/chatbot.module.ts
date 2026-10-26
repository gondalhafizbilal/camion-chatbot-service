import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { FileParserService } from './file-parser.service';
import { RedisModule } from '../../redis/redis.module';
import { LangchainModule } from '../../langchain/langchain.module';

@Module({
  imports: [ConfigModule, RedisModule, LangchainModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, FileParserService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
