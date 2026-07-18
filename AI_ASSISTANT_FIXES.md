# AI Assistant fixes

- Frontend now calls `/api/assistant/chat`, matching the backend's global `/api` router prefix.
- Fixed `get_current_workflow` tool dispatch so it returns compact workflow context.
- Preserved `validate_current_workflow` as a separate read-only tool.
- Fixed the assistant send-button CSS typo.
- Removed the hardcoded OpenAI API-key fallback from `docker-compose.yml`.
- Added `OPENAI_API_KEY` and `OPENAI_MODEL` placeholders to `.env.example`.

The real `.env` file is intentionally excluded. Keep your existing project `.env` file when replacing the project folder.
