# API Documentation

## POST /api/clean-sql-section

Processes one SQL section and returns cleaned SQL content.

### Request body

```json
{
  "section": {
    "type": "structure",
    "content": "CREATE TABLE ...",
    "priority": 1
  }
}
```

For `type: "data"`, additional fields are expected:

```json
{
  "section": {
    "type": "data",
    "content": "COPY public.users (id,name) FROM stdin;\\n1\\tAlice\\n\\\\.",
    "priority": 7,
    "tableName": "public.users",
    "chunkIndex": 1,
    "totalChunks": 4,
    "recordCount": 5
  }
}
```

### Responses

- `200 OK`

```json
{ "content": "(1, 'Alice')" }
```

- `400 Bad Request`

```json
{
  "error": {
    "code": "INVALID_SECTION",
    "message": "Invalid processing section payload."
  }
}
```

- `500 Internal Server Error` when `GEMINI_API_KEY` is missing
- `502 Bad Gateway` when Gemini returns empty content
