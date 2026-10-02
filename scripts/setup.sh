#!/usr/bin/env bash
# Pippin setup: asks a few questions and writes .env with fresh secrets.
# Works on Linux, macOS and WSL2. Safe to re-run: it never overwrites an existing .env without asking.
set -euo pipefail
cd "$(dirname "$0")/.."

rand() { openssl rand -hex "${1:-32}" 2>/dev/null || head -c "${1:-32}" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
ask() { local q="$1" def="${2:-}" a; read -r -p "$q${def:+ [$def]}: " a; echo "${a:-$def}"; }

if [[ -f .env ]]; then
  [[ "$(ask '.env already exists. Replace it? (y/N)' N)" =~ ^[Yy] ]] || { echo "Keeping your .env."; exit 0; }
  cp .env ".env.bak-$(date +%Y%m%d%H%M%S)"
fi

echo
echo "Which AI should Pippin use?"
echo "  1) Ollama on this computer (private, free)        4) OpenRouter"
echo "  2) ChatGPT / OpenAI (API key)                     5) Google Gemini (API key)"
echo "  3) Claude / Anthropic (API key)                   6) Another OpenAI-compatible server"
choice=$(ask "Choose 1-6" 1)
case "$choice" in
  1) provider=ollama;     model_def=qwen3:8b ;;
  2) provider=openai;     model_def=gpt-4.1-mini ;;
  3) provider=anthropic;  model_def=claude-sonnet-5-5 ;;
  4) provider=openrouter; model_def=anthropic/claude-sonnet-5.5 ;;
  5) provider=gemini;     model_def=gemini-2.5-flash ;;
  *) provider=custom;     model_def= ;;
esac
model=$(ask "Model name" "$model_def")
key=""; base=""
if [[ "$provider" != ollama && "$provider" != custom ]]; then
  read -r -s -p "API key (hidden): " key; echo
  echo "Note: with a cloud model, your coach conversations are sent to that provider."
fi
docker_mode=$(ask "Run with Docker? (Y/n)" Y)
if [[ "$provider" == custom ]]; then base=$(ask "Server address (ending in /v1)" "http://localhost:8080/v1"); fi
if [[ "$provider" == ollama && ! "$docker_mode" =~ ^[Yy] ]]; then base="http://localhost:11434/v1"; fi
tz=$(ask "Your time zone" "$(cat /etc/timezone 2>/dev/null || echo Europe/London)")
setup_code=$(rand 4)

sed -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand)|" \
    -e "s|^DATA_KEY=[^#]*|DATA_KEY=$(rand)   |" \
    -e "s|^DB_PASSWORD=.*|DB_PASSWORD=$(rand 24)|" \
    -e "s|^# SETUP_CODE=.*|SETUP_CODE=$setup_code|" \
    -e "s|^AI_PROVIDER=.*|AI_PROVIDER=$provider|" \
    -e "s|^AI_MODEL=.*|AI_MODEL=$model|" \
    -e "s|^TZ_DEFAULT=.*|TZ_DEFAULT=$tz|" \
    .env.example > .env
[[ -n "$key" ]] && sed -i.tmp "s|^# AI_API_KEY=.*|AI_API_KEY=$key|" .env
[[ -n "$base" ]] && sed -i.tmp "s|^# AI_BASE_URL=.*|AI_BASE_URL=$base|" .env
if [[ ! "$docker_mode" =~ ^[Yy] ]]; then
  sed -i.tmp -e "s|^# DB_HOST=.*|DB_HOST=localhost|" -e "s|^# DB_PORT=.*|DB_PORT=5432|" .env
fi
rm -f .env.tmp
chmod 600 .env

echo
echo "✅ Wrote .env"
echo "   Setup code for the first-run screen: $setup_code"
echo "   ⚠️  Back up DATA_KEY from .env somewhere safe — without it, encrypted chats can't be read."
echo
if [[ "$docker_mode" =~ ^[Yy] ]]; then
  echo "Next:  docker compose up -d --build    then open http://localhost:8910"
else
  echo "Next:  see 'Without Docker' in README.md (create the database, then npm install && npm start)"
fi
