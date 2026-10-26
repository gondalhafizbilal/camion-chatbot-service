import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";

import { FileInterceptor } from "@nestjs/platform-express";

import {
	AskQuestionDto,
	AskQuestionResponse,
	AskQuestionWithHistoryResponse,
	AskQuestionWithSessionDto,
	ChatSession,
	CreateSessionDto,
	CreateSessionResponse,
	GetHistoryResponse,
	UploadDocumentDto,
	UploadDocumentResponse,
} from "../../types/chatbot";

import { ChatbotService } from "./chatbot.service";

@Controller("v1/chatbot")
export class ChatbotController {
	constructor(private readonly chatbotService: ChatbotService) { }

	@Post("upload")
	@HttpCode(HttpStatus.CREATED)
	uploadDocument(@Body() body: UploadDocumentDto): Promise<UploadDocumentResponse> {
		return this.chatbotService.uploadDocument(body);
	}

	@Post("upload-file")
	@HttpCode(HttpStatus.CREATED)
	@UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 }, }))
	uploadFile(@UploadedFile() file: Express.Multer.File): Promise<UploadDocumentResponse> {
		return this.chatbotService.uploadFile(file);
	}

	@Post("ask")
	@HttpCode(HttpStatus.OK)
	askQuestion(@Body() body: AskQuestionDto): Promise<AskQuestionResponse> {
		return this.chatbotService.askQuestion(body);
	}

	@Delete("documents")
	@HttpCode(HttpStatus.NO_CONTENT)
	deleteAllDocuments(): Promise<void> {
		return this.chatbotService.deleteAllDocuments();
	}

	// ========== Chat History Endpoints ==========

	@Post("sessions")
	@HttpCode(HttpStatus.CREATED)
	createSession(@Body() body: CreateSessionDto): Promise<CreateSessionResponse> {
		return this.chatbotService.createSession(body);
	}

	@Post("sessions/:sessionUUID/ask")
	@HttpCode(HttpStatus.OK)
	askWithHistory(@Param("sessionUUID") sessionUUID: string, @Body() body: AskQuestionWithSessionDto): Promise<AskQuestionWithHistoryResponse> {
		return this.chatbotService.askQuestionWithHistory(sessionUUID, body);
	}

	@Get("sessions/:sessionUUID/history")
	@HttpCode(HttpStatus.OK)
	getSessionHistory(@Param("sessionUUID") sessionUUID: string): Promise<GetHistoryResponse> {
		return this.chatbotService.getSessionHistory(sessionUUID);
	}

	@Delete("sessions/:sessionUUID")
	@HttpCode(HttpStatus.NO_CONTENT)
	deleteSession(@Param("sessionUUID") sessionUUID: string): Promise<void> {
		return this.chatbotService.deleteSession(sessionUUID);
	}

	@Get("sessions")
	@HttpCode(HttpStatus.OK)
	getUserSessions(@Query("customerUUID") customerUUID: string): Promise<ChatSession[]> {
		return this.chatbotService.getAllUserSessions(customerUUID);
	}
}
