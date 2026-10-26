import * as crypto from "node:crypto";

import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	OnModuleInit,
	UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import weaviate, { WeaviateClient } from 'weaviate-ts-client';

import {
	AskQuestionDto,
	AskQuestionResponse,
	AskQuestionWithHistoryResponse,
	AskQuestionWithSessionDto,
	ChatMessage,
	ChatSession,
	CreateSessionDto,
	CreateSessionResponse,
	DocumentSource,
	GetHistoryResponse,
	UploadDocumentDto,
	UploadDocumentResponse,
	UploadOrdersDto
} from '../../types/chatbot';

import { RedisService } from '../../redis/redis.service';
import { LangchainService } from '../../langchain/langchain.service';
import { FileParserService } from "./file-parser.service";

export interface Document {
	content: string;
	title: string;
	category?: string;
	source?: string;
	metadata?: Record<string, any>;
}

const DOCUMENT_UPLOADED_SUCCESS_MESSAGE = 'Document uploaded successfully!';

@Injectable()
export class ChatbotService implements OnModuleInit {
	private readonly logger = new Logger(ChatbotService.name);

	private weaviateClient: WeaviateClient | null = null;
	private readonly className = 'ChatbotDocument';
	private readonly sessionPrefix = 'chatbot_session:';
	private readonly sessionTTL = 86400 * 7; // 7 days

	constructor(
		private readonly configService: ConfigService,
		private readonly langchainService: LangchainService,
		private readonly fileParserService: FileParserService,
		private readonly jwtService: JwtService,
		private readonly redisService: RedisService,
	) { }

	async onModuleInit() {
		await this.initializeClient();
	}

	private async initializeClient() {
		// Make sure weaviate can be initialized
		const weaviateUrl = "grpc-yg5nacquyige246ea07w.c0.asia-southeast1.gcp.weaviate.cloud";
		if (!weaviateUrl) {
			throw new Error(
				'Weaviate service is not properly configured: WEAVIATE_URL is required',
			);
		}

		// Initialize weaviate client
		try {
			this.weaviateClient = weaviate.client({
				scheme: "https",
				host: weaviateUrl,
				apiKey: new weaviate.ApiKey("QzlicjlqQkFLY2dDWTlBa193clRjMHJkVmoySG1XSWxqM0JZM0YvZ0xZK3lqQTJLWFhSRUdOTDY0a3djPV92MjAw"),
				headers: {
					'X-JinaAI-Api-Key': "jina_100a164b7c1141b3ad586fb8339a1077clnN06MZ2hKkeUb2v2Dh58e3ANmO",
				} as Record<string, string>,
			});
		} catch (err) {
			this.logger.error('Failed to connect to Weaviate:', err);
			throw err;
		}

		// Create the schema
		try {
			const schemaExists = await this.weaviateClient.schema.classGetter().withClassName(this.className)
				.do()
				.then(() => true)
				.catch(() => false);

			if (!schemaExists) {
				// Create ShippingAddress schema
				await this.weaviateClient.schema.classCreator()
					.withClass({
						class: "ShippingAddress",
						vectorizer: "text2vec-jinaai",
						// moduleConfig: {
						// 	'text2vec-jinaai': {
						// 		model: 'jina-embeddings-v2-base-en',
						// 	},
						// },
						properties: [
							{ name: "customer", dataType: ["text"], },
							{ name: "uuid", dataType: ["text"], },
							{ name: "fullName", dataType: ["text"], },
							{ name: "phoneNumber", dataType: ["text"], },
							{ name: "streetAddress", dataType: ["text"], },
							{ name: "apartment", dataType: ["text"], },
							{ name: "zipCode", dataType: ["text"], },
							{ name: "city", dataType: ["text"], },
							{ name: "state", dataType: ["text"], },
							{ name: "country", dataType: ["text"], },
							{ name: "isDefault", dataType: ["boolean"], },
						],
					})
					.do();

				// Create Product schema
				await this.weaviateClient.schema.classCreator()
					.withClass({
						class: "Product",
						vectorizer: "text2vec-jinaai",
						// moduleConfig: {
						// 	'text2vec-jinaai': {
						// 		model: 'jina-embeddings-v2-base-en',
						// 	},
						// },
						properties: [
							{ name: "uuid", dataType: ["text"], },
							{ name: "title", dataType: ["text"], },
							{ name: "brief", dataType: ["text"], },
							{ name: "status", dataType: ["text"], },
							{ name: "salesCount", dataType: ["int"], },
							{ name: "likesCount", dataType: ["int"], },
							{ name: "reviewsCount", dataType: ["int"], },
							{ name: "ratingAvg", dataType: ["text"], },
						],
					})
					.do();

				// Create Variant schema
				await this.weaviateClient.schema.classCreator()
					.withClass({
						class: "Variant",
						vectorizer: "text2vec-jinaai",
						// moduleConfig: {
						// 	'text2vec-jinaai': {
						// 		model: 'jina-embeddings-v2-base-en',
						// 	},
						// },
						properties: [
							{ name: "uuid", dataType: ["text"], },
							{ name: "title", dataType: ["text"], },
							{ name: "sku", dataType: ["text"], },
							{ name: "barcode", dataType: ["text"], },
						],
					})
					.do();

				// Create OrderItem schema
				await this.weaviateClient.schema.classCreator()
					.withClass({
						class: "OrderItem",
						vectorizer: "text2vec-jinaai",
						// moduleConfig: {
						// 	'text2vec-jinaai': {
						// 		model: 'jina-embeddings-v2-base-en',
						// 	},
						// },
						properties: [
							{ name: "uuid", dataType: ["text"], },
							{ name: "product", dataType: ["Product"], },
							{ name: "variant", dataType: ["Variant"], },
							{ name: "price", dataType: ["int"], },
							{ name: "currencyCode", dataType: ["text"], },
							{ name: "quantity", dataType: ["int"], },
							{ name: "total", dataType: ["int"], },
						],
					})
					.do();

				// Create Order schema
				await this.weaviateClient.schema.classCreator()
					.withClass({
						class: "Order",
						vectorizer: "text2vec-jinaai",
						// moduleConfig: {
						// 	'text2vec-jinaai': {
						// 		model: 'jina-embeddings-v2-base-en',
						// 	},
						// },
						properties: [
							{ name: "customer", dataType: ["text"], },
							{ name: "uuid", dataType: ["text"], },
							{ name: "orderItems", dataType: ["OrderItem"], },
							{ name: "shippingAddress", dataType: ["ShippingAddress"], },
							{ name: "status", dataType: ["text"], },
							{ name: "total", dataType: ["int"], },
							{ name: "currencyCode", dataType: ["text"], },
							{ name: "eta", dataType: ["text"], },
						],
					})
					.do();

				await this.weaviateClient.schema.classCreator()
					.withClass({
						class: this.className,
						vectorizer: "text2vec-jinaai",
						// moduleConfig: {
						// 	'text2vec-jinaai': {
						// 		model: 'jina-embeddings-v2-base-en',
						// 	},
						// },
						properties: [
							{ name: 'customer', dataType: ['text'], },
							{ name: "uuid", dataType: ["text"], },
							{ name: 'content', dataType: ['text'], },
							{ name: 'title', dataType: ['text'], },
							{ name: 'category', dataType: ['text'], },
							{ name: 'source', dataType: ['text'], },
							{ name: "orders", dataType: ["Order"], },
							{ name: 'timestamp', dataType: ['date'], },
						],
					})
					.do();
			}
		} catch (err) {
			this.logger.error("Failed to create schema in Weaviate:", err);
			throw err;
		}
	}

	/**
	 * Uploads a file to the knowledge base.
	 *
	 * @param file
	 * @returns
	 */
	async uploadFile(file: Express.Multer.File): Promise<UploadDocumentResponse> {
		if (!file) {
			throw new BadRequestException({
				error: "File is required",
			});
		}

		// Extract the content of the file
		const content = await this.fileParserService.extractText(file);
		if (content === undefined || content === null) {
			throw new BadRequestException({
				error: "Failed to parse the file. Please check and try again.",
			});
		}

		return this.uploadDocument({
			content: content,
			title: file.originalname,
			source: "file_upload",
		});
	}

	/**
	 * Uploads a document to the knowledge base
	 *
	 * @param body
	 * @returns
	 */
	async uploadDocument(body: UploadDocumentDto): Promise<UploadDocumentResponse> {
		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		const result = await this.weaviateClient.data.creator().withClassName(this.className)
			.withProperties({
				uuid: crypto.randomUUID(),
				content: body.content,
				title: body.title,
				category: 'support',
				source: body.source || 'manual_upload',
				orders: [],
				timestamp: new Date().toISOString(),
			})
			.do();

		if (result === undefined || result === null || result.id === undefined || result.id === null) {
			throw new BadRequestException({
				error: "Failed to add the document to the knowledge base. Please check and try again.",
			});
		}

		this.logger.log(`Uploaded document with ID: ${result.id}`);

		return {
			id: result.id,
			message: DOCUMENT_UPLOADED_SUCCESS_MESSAGE
		};
	}

	/**
	 * Deletes stuff from the documents
	 *
	 * @param customerUUID
	 * @param body
	 * @returns
	 */
	async removeOrders(customerUUID: string, body: UploadOrdersDto) {
		this.logger.log(`Removing order for customer: ${customerUUID}`);

		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		if (!customerUUID) {
			this.logger.error("Please add customer uuid for orders.");
			return;
		}

		if (!body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
			this.logger.error("Failed to find any order. Please make sure you have orders.");
			return;
		}

		// Get all orders of the customer
		const prevOrders = await this.weaviateClient.graphql.get()
			.withClassName("Order")
			.withFields("uuid")
			.withWhere({
				path: ["customer"],
				operator: "Equal",
				valueString: customerUUID,
			})
			.do();

		// Delete orders
		const ordersToDelete = prevOrders?.data?.Get?.Order ?? [];
		if (Array.isArray(ordersToDelete) && ordersToDelete.length !== 0) {
			for (const order of ordersToDelete) {
				this.logger.log(`Removing order: ${order.uuid}, for customer: ${customerUUID}`);
				try {
					await this.weaviateClient.data.deleter()
						.withClassName("Order")
						.withId(order.uuid)
						.do();
				} catch (err) {
					this.logger.error(err);
				}
			}
		}

		// Get all documents of the customer
		const prevDocuments = await this.weaviateClient.graphql.get()
			.withClassName(this.className)
			.withFields("uuid")
			.withWhere({
				path: ["customer"],
				operator: "Equal",
				valueString: customerUUID,
			})
			.do();

		// Delete documents
		const documentsToDelete = prevDocuments?.data?.Get?.ChatbotDocument ?? [];
		if (Array.isArray(documentsToDelete) && documentsToDelete.length !== 0) {
			for (const document of documentsToDelete) {
				this.logger.log(`Removing document: ${document.uuid}, for customer: ${customerUUID}`);
				try {
					await this.weaviateClient.data.deleter()
						.withClassName(this.className)
						.withId(document.uuid)
						.do();
				} catch (err) {
					this.logger.error(err);
				}
			}
		}

		// Get all shipping addresses of the customer
		const prevShippingAddresses = await this.weaviateClient.graphql.get()
			.withClassName("ShippingAddress")
			.withFields("uuid")
			.withWhere({
				path: ["customer"],
				operator: "Equal",
				valueString: customerUUID,
			})
			.do();

		const shippingAddressesToDelete = prevShippingAddresses?.data?.Get?.ShippingAddress ?? [];
		if (Array.isArray(shippingAddressesToDelete) && shippingAddressesToDelete.length !== 0) {
			for (const shippingAddress of shippingAddressesToDelete) {
				this.logger.log(`Removing shipping address: ${shippingAddress.uuid}, for customer: ${customerUUID}`);
				try {
					await this.weaviateClient.data.deleter()
						.withClassName("ShippingAddress")
						.withId(shippingAddress.uuid)
						.do();
				} catch (err) {
					this.logger.error(err);
				}
			}
		}

		for (let i = 0; i < body.orders.length; i++) {
			// Delete product, variant and order item
			if (Array.isArray(body.orders[i].orderItems) && body.orders[i].orderItems.length !== 0) {
				for (let j = 0; j < body.orders[i].orderItems.length; j++) {

					// Delete the product from the knowledge base
					this.logger.log(`Removing product: ${body.orders[i].orderItems[j].product.uuid}, for customer: ${customerUUID}`);
					try {
						await this.weaviateClient.data.deleter()
							.withClassName("Product")
							.withId(body.orders[i].orderItems[j].product.uuid)
							.do();
					} catch (err) {
						this.logger.error(err);
					}

					// Delete the variant from the knowledge base
					this.logger.log(`Removing variant: ${body.orders[i].orderItems[j].variant.uuid}, for customer: ${customerUUID}`);
					try {
						await this.weaviateClient.data.deleter()
							.withClassName("Variant")
							.withId(body.orders[i].orderItems[j].variant.uuid)
							.do();
					} catch (err) {
						this.logger.error(err);
					}

					// Delete the order item from the knowledge base
					this.logger.log(`Removing order item: ${body.orders[i].orderItems[j].uuid}, for customer: ${customerUUID}`);
					try {
						await this.weaviateClient.data.deleter()
							.withClassName("OrderItem")
							.withId(body.orders[i].orderItems[j].uuid)
							.do();
					} catch (err) {
						this.logger.error(err);
					}
				}
			}
		}
	}

	/**
	 * Uploads the orders to the knowledge base
	 *
	 * @param body
	 * @returns
	 */
	async uploadOrders(customerUUID: string, body: UploadOrdersDto) {
		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		if (!customerUUID) {
			this.logger.error("Please add customer uuid for orders.");
			return;
		}

		if (!body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
			this.logger.error("Failed to find any order. Please make sure you have orders.");
			return;
		}

		// Order beacons
		let orderBeacons: Array<{ beacon: string; }> = [];
		let orderItemsBeacons: Array<{ beacon: string }> = [];

		// Add orders to the database
		for (let i = 0; i < body.orders.length; i++) {
			// Add shipping address to the knowledge base
			try {
				await this.weaviateClient.data.creator().withClassName("ShippingAddress")
					.withId(body.orders[i].shippingAddress.uuid)
					.withProperties({
						customer: customerUUID,
						uuid: body.orders[i].shippingAddress.uuid,
						fullName: body.orders[i].shippingAddress.fullName,
						phoneNumber: body.orders[i].shippingAddress.phoneNumber,
						streetAddress: body.orders[i].shippingAddress.streetAddress,
						apartment: body.orders[i].shippingAddress.apartment,
						zipCode: body.orders[i].shippingAddress.zipCode,
						city: body.orders[i].shippingAddress.city,
						state: body.orders[i].shippingAddress.state,
						country: body.orders[i].shippingAddress.country,
						isDefault: body.orders[i].shippingAddress.isDefault,
					})
					.do();
			} catch (err) {
				this.logger.error(err);
			}

			// Add order items to the knowledge base
			if (Array.isArray(body.orders[i].orderItems) && body.orders[i].orderItems.length !== 0) {
				// Reset the order items array
				orderItemsBeacons = [];

				for (let j = 0; j < body.orders[i].orderItems.length; j++) {
					// Add product to the knowledge base
					try {
						await this.weaviateClient.data.creator().withClassName("Product")
							.withId(body.orders[i].orderItems[j].product.uuid)
							.withProperties({
								uuid: body.orders[i].orderItems[j].product.uuid,
								title: body.orders[i].orderItems[j].product.titleEn,
								brief: body.orders[i].orderItems[j].product.briefEn,
								status: body.orders[i].orderItems[j].product.status,
								salesCount: body.orders[i].orderItems[j].product.salesCount,
								likesCount: body.orders[i].orderItems[j].product.likesCount,
								reviewsCount: body.orders[i].orderItems[j].product.reviewsCount,
								ratingAvg: body.orders[i].orderItems[j].product.ratingAvg,
							})
							.do();
					} catch (err) {
						this.logger.error(err);
					}

					// Add variant to the knowledge base
					try {
						await this.weaviateClient.data.creator().withClassName("Variant")
							.withId(body.orders[i].orderItems[j].variant.uuid)
							.withProperties({
								uuid: body.orders[i].orderItems[j].variant.uuid,
								title: body.orders[i].orderItems[j].variant.titleEn,
								sku: body.orders[i].orderItems[j].variant.sku,
								barcode: body.orders[i].orderItems[j].variant.barcode,
							})
							.do();
					} catch (err) {
						this.logger.error(err);
					}

					// Add order item to the knowledge base
					try {
						await this.weaviateClient.data.creator().withClassName("OrderItem")
							.withId(body.orders[i].orderItems[j].uuid)
							.withProperties({
								price: body.orders[i].orderItems[j].price.amount,
								currencyCode: body.orders[i].orderItems[j].price.currencyCode,
								quantity: body.orders[i].orderItems[j].quantity,
								total: body.orders[i].orderItems[j].total.amount,
								product: [
									{
										beacon: `weaviate://localhost/Product/${body.orders[i].orderItems[j].product.uuid}`,
									},
								],
								variant: [
									{
										beacon: `weaviate://localhost/Variant/${body.orders[i].orderItems[j].variant.uuid}`,
									},
								],
							})
							.do();
					} catch (err) {
						this.logger.error(err);
					}

					// Order order item beacons
					orderItemsBeacons[orderItemsBeacons.length] = {
						beacon: `weaviate://localhost/OrderItem/${body.orders[i].orderItems[j].uuid}`,
					};
				}
			}

			// Add order to the knowledge base
			try {
				await this.weaviateClient.data.creator().withClassName("Order")
					.withId(body.orders[i].uuid)
					.withProperties({
						customer: customerUUID,
						uuid: body.orders[i].uuid,
						orderItems: orderItemsBeacons,
						shippingAddress: [
							{
								beacon: `weaviate://localhost/ShippingAddress/${body.orders[i].shippingAddress.uuid}`,
							},
						],
						status: body.orders[i].status,
						total: body.orders[i].total.amount,
						currencyCode: body.orders[i].total.currencyCode,
						eta: body.orders[i].eta,
					})
					.do();
			} catch (err) {
				this.logger.error(err);
			}

			// Add order beacons
			orderBeacons[orderBeacons.length] = {
				beacon: `weaviate://localhost/Order/${body.orders[i].uuid}`,
			};
		}

		// Add orders to chatbot document
		const uuid = crypto.randomUUID();
		const result = await this.weaviateClient.data.creator().withClassName(this.className)
			.withId(uuid)
			.withProperties({
				customer: customerUUID,
				uuid: uuid,
				content: "",
				title: "My Orders",
				category: 'orders',
				source: 'my-orders',
				orders: orderBeacons,
				timestamp: new Date().toISOString(),
			})
			.do();

		if (result === undefined || result === null || result.id === undefined || result.id === null) {
			throw new BadRequestException({
				error: "Failed to add the orders to the knowledge base. Please check and try again.",
			});
		}

		this.logger.log(`Uploaded document with ID: ${result.id}`);

		return {
			id: result.id,
			message: DOCUMENT_UPLOADED_SUCCESS_MESSAGE
		};
	}

	/**
	 * Asks a question using the internal knowledge base
	 *
	 * @param body
	 * @returns
	 */
	async askQuestion(body: AskQuestionDto): Promise<AskQuestionResponse> {
		const sources = await this.findRelevantSources(body.question, "support");
		if (!Array.isArray(sources) || sources.length === 0) {
			throw new BadRequestException({
				error: "Failed to find any answer in the knowledge base.",
			});
		}

		// Generate answer based on relevant documents
		const answer = await this.generateAnswer(body.question, sources);
		return {
			answer: answer,
		};
	}

	/**
	 * Finds the relevant documents for a query
	 *
	 * @param question
	 * @param category
	 * @returns
	 */
	private async findRelevantSources(
		question: string,
		category: string,
	): Promise<DocumentSource[]> {
		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		try {
			const result = await this.weaviateClient.graphql
				.get()
				.withClassName(this.className)
				.withFields(`
					uuid
					content
					title
					category
					source
					_additional {
						distance
					}
				`)
				.withWhere({
					path: ['category'],
					operator: 'Equal' as const,
					valueText: category,
				})
				.withNearText({ concepts: [question] })
				.withLimit(5)
				.do();

			const documents = result.data.Get[this.className] || [];
			this.logger.log(`Found ${documents.length} relevant documents`);

			return documents.map((item: any) => ({
				title: item.title,
				content: item.content,
				category: item.category,
				orders: [],
				relevanceScore: item._additional?.distance,
			}));
		} catch (error) {
			this.logger.error('Error finding relevant documents:', error);
			return [];
		}
	}

	/**
	 * Finds the relevant orders for a query from the customer
	 *
	 * @param question
	 * @param customerUUID
	 * @returns
	 */
	private async findRelevantSourcesByCustomer(
		question: string,
		customerUUID: string,
	): Promise<DocumentSource[]> {
		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		try {
			const result = await this.weaviateClient.graphql
				.get()
				.withClassName(this.className)
				.withFields(`
					uuid
					customer
					content
					title
					category
					source
					orders {
						... on Order {
							uuid
							orderItems {
								... on OrderItem {
									uuid
									product {
										... on Product {
											uuid
											title
											brief
											status
											salesCount
											likesCount
											reviewsCount
											ratingAvg
										}
									}
									variant {
										... on Variant {
											uuid
											title
											sku
											barcode
										}
									}
									price
									currencyCode
									quantity
									total
								}
							}
							shippingAddress {
								... on ShippingAddress {
									uuid
									fullName
									phoneNumber
									streetAddress
									apartment
									zipCode
									city
									state
									country
									isDefault
								}
							}
							status
							total
							currencyCode
							eta
						}
					}
					_additional {
						distance
					}
				`)
				.withNearText({ concepts: [question] })
				.withWhere({
					operator: 'Or' as const,
					operands: [
						{
							path: ["category"],
							operator: "Equal",
							valueText: "support",
						},
						{
							path: ["customer"],
							operator: "Equal",
							valueText: customerUUID,
						},
					],
				})
				.withLimit(5)
				.do();

			const documents = result.data.Get[this.className] || [];
			this.logger.log(`Found ${documents.length} relevant documents`);

			return documents.map((item: any) => ({
				title: item.title,
				content: item.content,
				category: item.category,
				orders: item.orders,
				relevanceScore: item._additional?.distance,
			}));
		} catch (error) {
			this.logger.error('Error finding relevant documents:', error);
			return [];
		}
	}

	/**
	 * Generates an answer
	 *
	 * @param question
	 * @param sources
	 * @param conversationHistory
	 * @returns
	 */
	private async generateAnswer(
		question: string,
		sources: DocumentSource[],
		conversationHistory?: ChatMessage[],
	): Promise<string> {
		if (sources.length === 0) {
			return "I don't have enough information in my knowledge base to answer that question.";
		}

		const context = sources
			.map((source, index) => `[Source ${index + 1}: ${source.title}]\n${source.content}\n${JSON.stringify(source.orders)}`)
			.join('\n\n');

		let historyBlock = '';
		if (conversationHistory && conversationHistory.length > 0) {
			historyBlock = `\n\nConversation history:\n` +
				conversationHistory
					.map((msg) => `${msg.role}: ${msg.content}`)
					.join('\n');
		}

		const systemPrompt =
			`You are a helpful assistant that answers questions based on the provided documents. ` +
			`Use only the information from the sources below to answer the question. ` +
			`If the sources don't contain enough information, say so. ` +
			`Be concise and direct in your response.` +
			`${historyBlock}\n\n` +
			`Documents:\n${context}`;

		try {
			return await this.langchainService.sendMessage(question, systemPrompt);
		} catch (error) {
			this.logger.error('LLM answer generation failed, falling back to raw context', error);
			return `Based on the available documents:\n\n${context}\n\nPlease review the sources above for information related to: "${question}"`;
		}
	}

	async deleteAllDocuments(): Promise<void> {
		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		try {
			await this.weaviateClient.schema.classDeleter().withClassName(this.className).do();
			this.logger.log('Deleted all chatbot documents');
		} catch (error) {
			this.logger.error('Error deleting documents:', error);
			throw error;
		}
	}

	getClient(): WeaviateClient | null {
		return this.weaviateClient;
	}

	// ========== Chat History Methods ==========

	/**
	 * Creates a new session
	 *
	 * @param body
	 * @returns
	 */
	async createSession(body: CreateSessionDto): Promise<CreateSessionResponse> {
		if (!this.redisService) {
			throw new InternalServerErrorException({
				error: "Redis service is not configured. Chat history requires Redis.",
			});
		}

		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		// Verify the jwt
		const tokenPayload: { jti: string, sub: string } = await this.jwtService.verifyAsync(body.token);
		if (!tokenPayload.sub) {
			throw new UnauthorizedException({
				error: "Authentication failed. Invalid or expired token.",
			});
		}

		// Fetch the customer orders via REST API using the above token
		const orders = await fetch(`${this.configService.get<string>('API_HOST')}/v1/orders?pageNumber=1&itemsPerPage=4`, {
			headers: {
				Authorization: `Bearer ${body.token}`,
			},
		}).then(res => res.json());

		// Retrieved orders for the customer
		this.logger.log(`Retrieved ${orders.length} orders for customer ${tokenPayload.sub}`);

		// Delete previous stuff from the knowledge base
		await this.removeOrders(tokenPayload.sub, { orders: orders, });

		// Add orders to the knowledge base
		await this.uploadOrders(tokenPayload.sub, { orders: orders, });

		const sessionUUID = crypto.randomUUID();
		const session: ChatSession = {
			sessionUUID: sessionUUID,
			customerUUID: tokenPayload.sub,
			messages: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await this.redisService.setSession(`${this.sessionPrefix}${sessionUUID}`, JSON.stringify(session), this.sessionTTL);

		this.logger.log(`Created chat session: ${sessionUUID}`);
		return {
			sessionUUID: sessionUUID,
			message: 'Chat session created successfully',
		};
	}

	/**
	 * Ask a question with a session
	 *
	 * @param sessionUUID
	 * @param question
	 * @returns
	 */
	async askQuestionWithHistory(
		sessionUUID: string,
		body: AskQuestionWithSessionDto,
	): Promise<AskQuestionWithHistoryResponse> {
		if (!this.redisService) {
			throw new InternalServerErrorException({
				error: "Redis service is not configured. Chat history requires Redis.",
			});
		}

		if (this.weaviateClient === null) {
			throw new InternalServerErrorException({
				error: "Failed to initialize the weaviate client.",
			});
		}

		// Verify the jwt
		const tokenPayload: { jti: string, sub: string } = await this.jwtService.verifyAsync(body.token);
		if (!tokenPayload.sub) {
			throw new UnauthorizedException({
				error: "Authentication failed. Invalid or expired token.",
			});
		}

		// Get existing session
		const key = `${this.sessionPrefix}${sessionUUID}`;
		const sessionData = await this.redisService.getSession(key);
		if (!sessionData) {
			throw new InternalServerErrorException({
				error: `Session not found: ${sessionUUID}`,
			});
		}

		const session: ChatSession = JSON.parse(sessionData);

		// Add user message to history
		const userMessage: ChatMessage = {
			role: 'user',
			content: body.question,
			timestamp: new Date().toISOString(),
		};

		session.messages.push(userMessage);

		// Find the relevant orders and support documents of the customer
		const sources = await this.findRelevantSourcesByCustomer(body.question, tokenPayload.sub);

		// Generate the answer
		const answer = await this.generateAnswer(body.question, sources, session.messages);

		// Add assistant message to history
		const assistantMessage: ChatMessage = {
			role: 'assistant',
			content: answer,
			timestamp: new Date().toISOString(),
		};
		session.messages.push(assistantMessage);

		// Update session
		session.updatedAt = new Date().toISOString();
		await this.redisService.setSession(key, JSON.stringify(session), this.sessionTTL);

		this.logger.log(`Updated session ${sessionUUID} with new Q&A`);

		return {
			answer: answer,
		};
	}

	/**
	 * Returns a new question
	 *
	 * @param sessionUUID
	 * @returns
	 */
	async getSessionHistory(sessionUUID: string): Promise<GetHistoryResponse> {
		if (!this.redisService) {
			throw new InternalServerErrorException({
				error: "Redis service is not configured. Chat history requires Redis.",
			});
		}

		const sessionData = await this.redisService.getSession(`${this.sessionPrefix}${sessionUUID}`);
		if (!sessionData) {
			throw new NotFoundException({
				error: "Failed to find the requested session. Please check and try again.",
			});
		}

		const session: ChatSession = JSON.parse(sessionData);
		return {
			sessionUUID: session.sessionUUID,
			messages: session.messages,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
		};
	}

	/**
	 * Delete a session
	 *
	 * @param sessionUUID
	 */
	async deleteSession(sessionUUID: string): Promise<void> {
		if (!this.redisService) {
			throw new InternalServerErrorException({
				error: `Redis service is not configured. Chat history requires Redis.`,
			});
		}

		const key = `${this.sessionPrefix}${sessionUUID}`;
		await this.redisService.deleteSession(key);
		this.logger.log(`Deleted chat session: ${sessionUUID}`);
	}

	/**
	 * Retrieve all sessions
	 *
	 * @param customerUUID
	 * @returns
	 */
	async getAllUserSessions(customerUUID: string): Promise<ChatSession[]> {
		if (!this.redisService) {
			throw new InternalServerErrorException({
				error: 'Redis service is not configured. Chat history requires Redis.',
			});
		}

		const sessions = await this.redisService.getSessionsByPattern(`${this.sessionPrefix}*`);
		const userSessions: ChatSession[] = [];

		for (const sessionData of sessions) {
			try {
				const session: ChatSession = JSON.parse(sessionData);
				if (session.customerUUID === customerUUID) {
					userSessions.push(session);
				}
			} catch (error) {
				this.logger.warn('Failed to parse session data', error);
			}
		}

		return userSessions;
	}
}
