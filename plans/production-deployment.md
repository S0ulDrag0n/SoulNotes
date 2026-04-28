# Production Deployment Guide

## Overview

This guide explains how to configure SoulNotes for production server deployment. The default configuration uses localhost (127.0.0.1) for local development. For production, you need to override these defaults using environment variables or local configuration files.

## Server Configuration

### Default Configuration (Development)

By default, SoulNotes is configured to use localhost:

| Service | Default URL | Port | Purpose |
|---------|-------------|------|---------|
| Speaches (Transcription) | http://127.0.0.1 | 10300 | Real-time audio transcription |
| Ollama (AI Services) | http://127.0.0.1 | 10102 | Translation, summarization, conversation |

## Production Override Methods

### Method 1: Environment Variables (Recommended for Docker/Server)

Create a `.env.local` file (web/Next.js) or set environment variables in your deployment environment:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://YOUR_PRODUCTION_SERVER:10102
OLLAMA_API_TOKEN=your_api_token_here  # Optional: for authenticated instances
OLLAMA_TRANSLATE_MODEL=aya-expanse:latest
OLLAMA_SUMMARIZE_MODEL=phi4:latest
OLLAMA_CONVERSATION_MODEL=aya-expanse:latest

# Speaches Configuration
SPEACHES_BASE_URL=http://YOUR_PRODUCTION_SERVER:10300
SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3
SPEACHES_TRANSCRIBE_LANGUAGE=zh

# Client-side Speaches Configuration (required for browser)
NEXT_PUBLIC_SPEACHES_BASE_URL=http://YOUR_PRODUCTION_SERVER:10300
NEXT_PUBLIC_SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3
NEXT_PUBLIC_SPEACHES_TTS_MODEL=speaches-ai/Kokoro-82M-v1.0-ONNX
```

**Important:** Never commit `.env.local` to version control. It's already in `.gitignore`.

### Method 2: Configuration File (Recommended for Tauri Desktop App)

Create a `config.local.yml` file next to the Tauri executable or in the appropriate config directory:

```yaml
# SoulNotes Production Configuration
# Copy this to config.yml or use alongside config.example.yml

# Speaches (Real-time Transcription) Settings
speaches_base_url: "http://YOUR_PRODUCTION_SERVER:10300"
speaches_transcribe_model: "Systran/faster-whisper-large-v3"
speaches_transcribe_language: "zh"

# Ollama (Translation & Summarization) Settings
ollama_base_url: "http://YOUR_PRODUCTION_SERVER:10102"
ollama_api_token: null  # Set your API token here if required
ollama_translate_model: "aya-expanse:latest"
ollama_summarize_model: "phi4:latest"
ollama_conversation_model: "aya-expanse:latest"

# Audio Device Settings (persisted automatically)
mic_device: null
system_audio_device: null
capture_mode: null
```

**Important:** `config.local.yml` is in `.gitignore` and should never be committed.

### Method 3: Docker Environment Variables

For Docker deployments, pass environment variables directly:

```bash
docker run -d \
  -e OLLAMA_BASE_URL=http://YOUR_PRODUCTION_SERVER:10102 \
  -e SPEACHES_BASE_URL=http://YOUR_PRODUCTION_SERVER:10300 \
  -e NEXT_PUBLIC_SPEACHES_BASE_URL=http://YOUR_PRODUCTION_SERVER:10300 \
  soulnotes:latest
```

Or use a Docker Compose file:

```yaml
version: '3.8'
services:
  soulnotes:
    image: soulnotes:latest
    environment:
      - OLLAMA_BASE_URL=http://YOUR_PRODUCTION_SERVER:10102
      - SPEACHES_BASE_URL=http://YOUR_PRODUCTION_SERVER:10300
      - NEXT_PUBLIC_SPEACHES_BASE_URL=http://YOUR_PRODUCTION_SERVER:10300
    ports:
      - "3000:3000"
```

## Configuration Priority

SoulNotes resolves configuration in the following order (highest to lowest priority):

1. **Environment Variables** - Override everything else
2. **Configuration File** (`config.yml` or `config.local.yml`)
3. **Code Defaults** - `127.0.0.1` (localhost)

## Production Server Requirements

### Network Configuration

- Ensure your production server is accessible from client machines
- Open ports 10102 (Ollama) and 10300 (Speaches) in your firewall
- Consider using HTTPS for production deployments (requires reverse proxy)

### Example Production Setup

```
Production Server: 10.61.46.95
├── Ollama Service    → http://10.61.46.95:10102
└── Speaches Service  → http://10.61.46.95:10300

Client Configuration (.env.local or config.local.yml):
├── OLLAMA_BASE_URL=http://10.61.46.95:10102
└── SPEACHES_BASE_URL=http://10.61.46.95:10300
```

## Testing Production Configuration

### Web/Next.js

1. Create `.env.local` with production URLs
2. Run `npm run dev` (development) or `npm run build && npm start` (production)
3. Check browser console for any connection errors
4. Verify transcription and AI services are working

### Tauri Desktop App

1. Create `config.local.yml` next to the executable
2. Launch the application
3. Check Settings panel to verify URLs are correct
4. Test transcription and AI services

### Docker

1. Set environment variables in docker-compose.yml or run command
2. Start the container
3. Access the web interface and verify services are connected

## Troubleshooting

### Connection Refused Errors

- Verify the production server IP is correct
- Check firewall rules allow traffic on ports 10102 and 10300
- Ensure services (Ollama, Speaches) are running on the production server

### Services Not Responding

- Check that Ollama and Speaches services are running
- Verify the models specified in configuration are available
- Check server logs for errors

### CORS Issues (Web Deployment)

If deploying the web frontend separately from the API services, you may need to configure CORS on your Ollama and Speaches servers to allow requests from your frontend domain.

## Security Considerations

1. **Never commit production IPs or API tokens to version control**
2. Use `.env.local` and `config.local.yml` for sensitive configuration (both are gitignored)
3. Consider using HTTPS for production deployments
4. Implement authentication if exposing services publicly
5. Regularly rotate API tokens if using authenticated Ollama instances

## Quick Reference

### Files to Create for Production

| File | Location | Purpose |
|------|----------|---------|
| `.env.local` | Project root | Web/Next.js environment overrides |
| `config.local.yml` | Next to Tauri executable | Desktop app configuration |

### Files to NEVER Commit

- `.env.local`
- `.env.*.local`
- `config.local.yml`
- Any file containing production server IPs or API tokens
