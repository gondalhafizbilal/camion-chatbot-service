# Chatbot Service

A NestJS-based AI chatbot service that provides document-based Q&A with conversation history support. It uses Weaviate for vector storage, Redis for session management, and Google Gemini (via LangChain) for LLM-powered answers.

## Features

- **Document Management**: Upload and store documents in Weaviate vector database
- **File Upload Support**: PDF, DOCX, and TXT file parsing
- **Semantic Search**: Find relevant documents using vector similarity
- **LLM-Powered Answers**: Generate intelligent answers using Google Gemini
- **Session Management**: Maintain conversation history with Redis
- **Context-Aware Chat**: Follow-up questions understand previous conversation context

## Tech Stack

- **Framework**: NestJS
- **Vector Database**: Weaviate
- **Session Store**: Redis
- **LLM**: Google Gemini (via LangChain)
- **File Parsing**: pdf-parse, mammoth

## Prerequisites

- Node.js (v18+)
- Redis server running
- Weaviate instance running
- Google AI API key

## Environment Variables

Create a `.env` file in the root directory:

```env
# Weaviate
WEAVIATE_URL=http://localhost:8080

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Google AI (Gemini)
GOOGLE_API_KEY=your_google_api_key
```

## Installation

```bash
npm install
```

## Running the Service

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The service will be available at `http://localhost:3000`.

## Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Endpoints

### Health Check

| Method | Endpoint | Description   |
|--------|----------|-------------- |
| GET    | `/`      | Health check  |

### Chatbot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chatbot/ask` | Ask a question (stateless) |
| POST | `/v1/chatbot/upload` | Upload document (JSON) |
| POST | `/v1/chatbot/upload-file` | Upload file (PDF/DOCX/TXT) |
| DELETE | `/v1/chatbot/documents` | Delete all documents |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chatbot/sessions` | Create a new chat session |
| GET | `/v1/chatbot/sessions` | Get all sessions for a user |
| GET | `/v1/chatbot/sessions/:id/history` | Get session history |
| POST | `/v1/chatbot/sessions/:id/ask` | Ask question with history |
| DELETE | `/v1/chatbot/sessions/:id` | Delete a session |

## Usage Examples

### 1. Ask a Question (Stateless)

```bash
curl -X POST http://localhost:3000/api/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the platform role?",
    "limit": 5,
    "category": "general"
  }'
```

### 2. Upload a Document

```bash
curl -X POST http://localhost:3000/api/chatbot/upload \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your document content here...",
    "title": "Document Title",
    "category": "general"
  }'
```

### 3. Upload a File

```bash
curl -X POST http://localhost:3000/api/chatbot/upload-file \
  -F "file=@/path/to/document.pdf" \
  -F "title=My Document" \
  -F "category=technical"
```

### 4. Create a Chat Session

```bash
curl -X POST http://localhost:3000/api/chatbot/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123"}'
```

### 5. Ask with History (Session-Based)

```bash
curl -X POST http://localhost:3000/api/chatbot/sessions/{sessionId}/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell me more about it"}'
```

### 6. Get Session History

```bash
curl http://localhost:3000/api/chatbot/sessions/{sessionId}/history
```

### 7. Delete a Session

```bash
curl -X DELETE http://localhost:3000/api/chatbot/sessions/{sessionId}
```

## Project Structure

src/
├── app.module.ts              # Main application module
├── config/
│   └── env.config.ts          # Environment configuration
├── langchain/
│   ├── langchain.module.ts    # LangChain module
│   └── langchain.service.ts   # LLM service (Gemini)
├── redis/
│   ├── redis.module.ts        # Redis module
│   └── redis.service.ts       # Session storage service
├── types/
│   └── chatbot.ts             # DTOs and interfaces
└── weaviate/
    └── chatbot/
        ├── chatbot.module.ts      # Chatbot module
        ├── chatbot.controller.ts  # API endpoints
        ├── chatbot.service.ts     # Core chatbot logic
        └── file-parser.service.ts # File parsing (PDF/DOCX/TXT)

## Session Behavior

- Sessions are stored in Redis with a 7-day TTL
- Each session maintains full conversation history
- The LLM receives conversation history for context-aware responses
- Follow-up questions like "tell me more" work correctly
