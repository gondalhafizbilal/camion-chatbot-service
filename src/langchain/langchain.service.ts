import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

@Injectable()
export class LangchainService {
  private readonly logger = new Logger(LangchainService.name);
  private model: ChatGoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error(
        'LangChain service is not properly configured: GOOGLE_API_KEY is required',
      );
    }

    this.model = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-2.5-flash-lite',
      temperature: 0.7,
    });

    this.logger.log('LangChain Gemini model initialized');
  }

  /**
   * Send a message to the Gemini model and get a response
   */
  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    try {
      const messages: BaseMessage[] = [];

      if (systemPrompt) {
        messages.push(new SystemMessage(systemPrompt));
      }

      messages.push(new HumanMessage(message));

      const response = await this.model.invoke(messages);

      const content = response.content;
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (error) {
      this.logger.error('Error sending message to Gemini:', error);
      throw error;
    }
  }

}
