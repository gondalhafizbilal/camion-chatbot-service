Chatbox REST API
================

Upload document (JSON)
----------------------

```http
POST /v1/chatbot/upload HTTP/1.1
```

### Request Body

```json
{
    "title": "Speed of light",
    "content": "The speed of light in vacuum, often called simply the speed of light and commonly denoted c, is a universal physical constant exactly equal to 299792458 m⋅s−1.[2] It is exact because, by international agreement, a metre is defined as the length of the path travelled by light in vacuum during a time interval of 1⁄299792458 second. The value 299,792,458 metres per second is approximately 1 billion kilometres per hour; 700 million miles per hour. For other approximations of c valid for various units and size scales see the infobox.",
    "source": "https://en.wikipedia.org/wiki/Speed_of_light"
}
```

### Response Body

```json
{
    "id": "56e5d92b-57fd-4ed3-a631-ef7d38c435fd",
    "message": "Document uploaded successfully!"
}
```

Ask a question (stateless)
--------------------------

```http
POST /v1/chatbot/ask HTTP/1.1
```

### Request Body

```json
{
    "question": "What is speed of light?"
}
```

### Response Body

```json
{
    "answer": "The speed of light in a vacuum, denoted as c, is a universal physical constant exactly equal to 299,792,458 meters per second. This value is approximately 1 billion kilometers per hour or 700 million miles per hour."
}
```

Upload file (DOCX/TXT)
--------------------------

```http
POST /v1/chatbot/upload-file HTTP/1.1
```

### Request Body

```bash
curl --location --request POST 'http://localhost:3000/v1/chatbot/upload-file' --form 'file=@"/C:/Users/Desktop/Work/Vacuum-Wikipedia.text"'
```

### Response Body

```json
{
    "id": "ad752868-4e1f-4010-bd53-2372a08b9e11",
    "message": "Document uploaded successfully!"
}
```

Sessions
========

Create a new chat session
-------------------------

```http
POST /v1/chatbot/sessions HTTP/1.1
```

### Request Body

```json
{
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYjg1OTA5Ny1jOGZmLTQwODQtODllYy0zNzU1OTQ1YmNkMDAiLCJ0eXBlIjoiY3VzdG9tZXIiLCJzdWIiOiI5YzJkY2Q5ZC1lYzZmLTRiZmUtODM5Yy0yMWQ0ZjQ3YTQwNTEiLCJpYXQiOjE3Nzc4MDczMzgsImV4cCI6MTc3Nzg5MzczOCwiaXNzIjoiQ2FtaW9uIn0.C32-UaqXdGF4KdncTsDEOJvWACkYf40YA1lVh91fYoFHWVGVNcYxInZg8Wx_6GzUlp9oIXMoniyAfiCgeCGqDTFR3mNVsr-c8v_o5FyYiTbdFf2_dEON6XnjJckuxPHO0Yfb3rvOU1Ny1iMAF_fR6rKkfZRS3RAStLAxedILmvVWxZQR7dbe3s7zmjOZovPoddT6wi4199FH2UchHm7H9g-I6Z6NVUU8sKxGlwuiDuB2E4Ln4SQoSn1X9ioZWUQsbMTUSHSjak9ilkW8BaPyWEuHIgcov3w2u3cf8UTP1h4v0tZjmz3bl3kzg-6YnJND6pPFsUx4pHadN_rIsyXdBg"
}
```

### Response Body

```json
{
    "sessionUUID": "f196a6fd-53fd-4400-89f1-97b746816a7b",
    "message": "Chat session created successfully"
}
```

Ask question with history
-------------------------

```http
POST /v1/chatbot/sessions/<session-uuid>/ask HTTP/1.1
```

### Request Body

```json
{
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYjg1OTA5Ny1jOGZmLTQwODQtODllYy0zNzU1OTQ1YmNkMDAiLCJ0eXBlIjoiY3VzdG9tZXIiLCJzdWIiOiI5YzJkY2Q5ZC1lYzZmLTRiZmUtODM5Yy0yMWQ0ZjQ3YTQwNTEiLCJpYXQiOjE3Nzc4MDczMzgsImV4cCI6MTc3Nzg5MzczOCwiaXNzIjoiQ2FtaW9uIn0.C32-UaqXdGF4KdncTsDEOJvWACkYf40YA1lVh91fYoFHWVGVNcYxInZg8Wx_6GzUlp9oIXMoniyAfiCgeCGqDTFR3mNVsr-c8v_o5FyYiTbdFf2_dEON6XnjJckuxPHO0Yfb3rvOU1Ny1iMAF_fR6rKkfZRS3RAStLAxedILmvVWxZQR7dbe3s7zmjOZovPoddT6wi4199FH2UchHm7H9g-I6Z6NVUU8sKxGlwuiDuB2E4Ln4SQoSn1X9ioZWUQsbMTUSHSjak9ilkW8BaPyWEuHIgcov3w2u3cf8UTP1h4v0tZjmz3bl3kzg-6YnJND6pPFsUx4pHadN_rIsyXdBg",
    "question": "What is the eta on my orders?"
}
```

### Response Body

```json
{
    "answer": "The eta on your orders is 6-10 working days."
}
```

Get all sessions for a customer
-------------------------------

```http
GET /v1/chatbot/sessions?customerUUID=9c2dcd9d-ec6f-4bfe-839c-21d4f47a4051 HTTP/1.1
```

### Response Body

```json
[
    {
        "sessionUUID": "e3318d6f-692b-4c60-baee-d5b03f89b215",
        "customerUUID": "9c2dcd9d-ec6f-4bfe-839c-21d4f47a4051",
        "messages": [],
        "createdAt": "2026-05-03T21:22:32.673Z",
        "updatedAt": "2026-05-03T21:22:32.673Z"
    },
    {
        "sessionUUID": "698777fd-badb-4057-aab2-742a7071c741",
        "customerUUID": "9c2dcd9d-ec6f-4bfe-839c-21d4f47a4051",
        "messages": [
            {
                "role": "user",
                "content": "What is the status of my order",
                "timestamp": "2026-05-03T21:30:54.466Z"
            },
            {
                "role": "assistant",
                "content": "The status of your order is \"payment_pending\".",
                "timestamp": "2026-05-03T21:31:04.618Z",
                "sources": []
            },
            {
                "role": "user",
                "content": "When will my order reach?",
                "timestamp": "2026-05-03T21:31:23.283Z"
            },
            {
                "role": "assistant",
                "content": "Your order is estimated to reach in 6-10 working days.",
                "timestamp": "2026-05-03T21:31:36.614Z",
                "sources": []
            },
            {
                "role": "user",
                "content": "When will my order reach?",
                "timestamp": "2026-05-03T21:31:59.881Z"
            },
            {
                "role": "assistant",
                "content": "Your order is estimated to reach in 6-10 working days.",
                "timestamp": "2026-05-03T21:32:06.797Z",
                "sources": []
            }
        ],
        "createdAt": "2026-05-03T21:29:32.073Z",
        "updatedAt": "2026-05-03T21:32:06.797Z"
    },
    {
        "sessionUUID": "0c1e7425-febc-4657-ad26-509beda8e97e",
        "customerUUID": "9c2dcd9d-ec6f-4bfe-839c-21d4f47a4051",
        "messages": [
            {
                "role": "user",
                "content": "When will my order reach?",
                "timestamp": "2026-05-03T21:44:49.124Z"
            },
            {
                "role": "assistant",
                "content": "I am sorry, but I cannot answer your question. The provided document does not contain information about when your order will reach.",
                "timestamp": "2026-05-03T21:45:01.306Z",
                "sources": []
            },
            {
                "role": "user",
                "content": "What items are in my order",
                "timestamp": "2026-05-03T21:45:25.066Z"
            },
            {
                "role": "assistant",
                "content": "I am sorry, but I cannot answer your question. The provided document does not contain information about what items are in your order.",
                "timestamp": "2026-05-03T21:45:35.818Z",
                "sources": []
            },
            {
                "role": "user",
                "content": "What items are in my order",
                "timestamp": "2026-05-03T21:47:59.032Z"
            },
            {
                "role": "assistant",
                "content": "The items in your order are: iPhone 20 RED 1 TB.",
                "timestamp": "2026-05-03T21:48:06.947Z",
                "sources": []
            }
        ],
        "createdAt": "2026-05-03T21:42:10.683Z",
        "updatedAt": "2026-05-03T21:48:06.947Z"
    },
]
```

Get session history
-------------------

```http
GET /v1/chatbot/sessions/<session-uuid>/history HTTP/1.1
```

### Response Body

```json
{
    "sessionUUID": "698777fd-badb-4057-aab2-742a7071c741",
    "messages": [
        {
            "role": "user",
            "content": "What is the status of my order",
            "timestamp": "2026-05-03T21:30:54.466Z"
        },
        {
            "role": "assistant",
            "content": "The status of your order is \"payment_pending\".",
            "timestamp": "2026-05-03T21:31:04.618Z",
            "sources": []
        },
        {
            "role": "user",
            "content": "When will my order reach?",
            "timestamp": "2026-05-03T21:31:23.283Z"
        },
        {
            "role": "assistant",
            "content": "Your order is estimated to reach in 6-10 working days.",
            "timestamp": "2026-05-03T21:31:36.614Z",
            "sources": []
        },
        {
            "role": "user",
            "content": "When will my order reach?",
            "timestamp": "2026-05-03T21:31:59.881Z"
        },
        {
            "role": "assistant",
            "content": "Your order is estimated to reach in 6-10 working days.",
            "timestamp": "2026-05-03T21:32:06.797Z",
            "sources": []
        }
    ],
    "createdAt": "2026-05-03T21:29:32.073Z",
    "updatedAt": "2026-05-03T21:32:06.797Z"
}
```

Delete a session
----------------

```http
DELETE /v1/chatbot/sessions/<session-uuid> HTTP/1.1
```
