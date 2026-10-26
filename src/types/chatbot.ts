import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsEmail, MinLength, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadDocumentDto {
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty({ message: 'title field is required' })
	readonly title: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty({ message: 'content field is required' })
	readonly content: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsOptional()
	readonly source?: string;
}

export class UploadOrdersDto {
	public readonly orders: Array<{
		customerUUID: string;
		uuid: string;
		orderItems: Array<{
			uuid: string;
			product: {
				uuid: string;
				titleEn: string;
				briefEn: string;
				status: string;
				salesCount: number;
				likesCount: number;
				reviewsCount: number;
				ratingAvg: string;
			};
			variant: {
				uuid: string;
				titleEn: string;
				sku: string;
				barcode: string;
			};
			quantity: number;
			price: {
				amount: number;
				currencyCode: string;
			};
			total: {
				amount: number;
				currencyCode: string;
			};
		}>;
		shippingAddress: {
			uuid: string;
			fullName: string;
			phoneNumber: string;
			streetAddress: string;
			apartment: string;
			zipCode: string;
			city: string;
			state: string;
			country: string;
			isDefault: boolean;
		};
		status: string;
		total: {
			amount: number;
			currencyCode: string;
		};
		eta: string;
	}>;
}

export class AskQuestionDto {
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty({ message: 'question field is required' })
	question: string;
}

export type UploadDocumentResponse = {
	id: string;
	message: string;
};

export type AskQuestionResponse = {
	answer: string;
};

export type DocumentSource = {
	title: string;
	content: string;
	orders: Array<{
		uuid: string;
		status: string;
	}>
	category?: string;
	relevanceScore?: number;
};

// Chat History Types
export class ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
}

export class ChatSession {
	sessionUUID: string;
	customerUUID?: string;
	messages: ChatMessage[];
	createdAt: string;
	updatedAt: string;
}

export class CreateSessionDto {
	@IsString()
	@MinLength(1)
	readonly token: string;
}

export class AskQuestionWithSessionDto {
	@IsString()
	@MinLength(1)
	readonly token: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty({ message: 'question field is required' })
	question: string;
}

export class GetHistoryDto {
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty({ message: 'sessionUUID field is required' })
	sessionUUID: string;
}

export type CreateSessionResponse = {
	sessionUUID: string;
	message: string;
};

export type GetHistoryResponse = {
	sessionUUID: string;
	messages: ChatMessage[];
	createdAt: string;
	updatedAt: string;
};

export type AskQuestionWithHistoryResponse = {
	answer: string;
};
