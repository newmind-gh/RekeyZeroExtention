# The local project has no FastAPI or Ollama service dependency.
.PHONY: setup test check-web check-extension

setup:
	cd apps/extension && npm ci
	cd apps/web && npm ci

test: check-extension check-web

check-extension:
	cd apps/extension && npm test && npm run check

check-web:
	cd apps/web && npm run check
