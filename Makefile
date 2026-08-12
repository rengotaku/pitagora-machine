.PHONY: install run build preview stop status lint lint-fix format format-check \
	typecheck test test-watch test-cov check ci clean help

# Default target
.DEFAULT_GOAL := help

PORT ?= 5173

## install: 依存をインストールする (lockfile 通り)
install:
	npm ci

## run: Vite dev サーバを起動する
run:
	npm run dev -- --port $(PORT)

## build: 本番用バンドルをビルドする
build:
	npm run build

## preview: ビルド済みバンドルをローカルで配信する
preview:
	npm run preview -- --port $(PORT)

## stop: dev サーバを停止する
stop:
	@lsof -ti :$(PORT) | xargs kill 2>/dev/null || true

## status: dev サーバの稼働状況を表示する
status:
	@lsof -i :$(PORT) >/dev/null 2>&1 && echo "pitagora-machine: running (:$(PORT))" || echo "pitagora-machine: stopped"

## lint: ESLint を実行する
lint:
	npm run lint

## lint-fix: ESLint の自動修正を実行する
lint-fix:
	npm run lint:fix

## format: Prettier で整形する
format:
	npm run format

## format-check: 整形済みかを検査する
format-check:
	npm run format:check

## typecheck: 型チェックのみ実行する
typecheck:
	npx tsc -b

## test: テストを実行する
test:
	npm run test

## test-watch: テストを watch モードで実行する
test-watch:
	npm run test:watch

## test-cov: カバレッジ付きでテストを実行する (しきい値 80%)
test-cov:
	npm run test:coverage

## check: lint + test
check: lint test

## ci: CI と同じゲート (lint / format / 型 / カバレッジ / build)
ci: lint format-check typecheck test-cov build

## clean: 生成物を削除する
clean:
	rm -rf dist coverage node_modules/.tmp

## help: ターゲット一覧を表示する
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'
