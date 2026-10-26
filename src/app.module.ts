import * as fs from "node:fs";
import * as path from "node:path";

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LangchainModule } from './langchain/langchain.module';
import { ChatbotModule } from './weaviate/chatbot/chatbot.module';

import { JwtModule } from "@nestjs/jwt";
import { HealthModule } from './health/health.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ['.env'],
		}),
		JwtModule.registerAsync({
			global: true,
			useFactory: () => ({
				publicKey: fs.readFileSync(path.join(process.cwd(), "certs/public.pem"), "utf-8"),
				verifyOptions: {
					algorithms: ["RS256"],
				},
			}),
		}),
		LangchainModule,
		ChatbotModule,
		HealthModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
