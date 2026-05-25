# SoulNotes

Real-time speech transcription, translation, and summarization application.

**SoulNotes is now open source and free!** All features are available to all users at no cost.

## Features

- **Live Speech Recognition** - Capture audio from your microphone in real-time
- **Real-time Translation** - Translate speech on-the-fly as you speak
- **Automatic Summarization** - Get structured meeting notes automatically
- **AI Conversation Partner** - Practice conversations with an AI partner in your target language
- **Vocabulary Flashcards** - Spaced repetition system for learning new vocabulary
- **Multi-language Support** - Support for English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, and Arabic
- **Dark Mode** - Toggle between light and dark themes
- **Desktop App** - Standalone Windows executable (Tauri)
- **Multiple LLM Providers** - Use Ollama or any OpenAI-compatible server (llama.cpp, LM Studio, vLLM, text-generation-webui)

## Quick Start (Web)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Desktop App (Tauri)

### Prerequisites

- **Node.js** 18+ 
- **Rust** 1.70+ (install via [rustup](https://rustup.rs/))
- **Visual Studio Build Tools** (Windows) - for compiling Rust dependencies

### Build Commands

```bash
# Install dependencies
npm install

# Build Tauri desktop app (production)
npm run tauri:build

# Or for development mode (with hot reload)
npm run tauri:dev
```

### Output Files

After building, the following files are generated:
- **Executable:** `src-tauri/target/release/app.exe`
- **MSI Installer:** `src-tauri/target/release/bundle/msi/SoulNotes_0.1.0_x64_en-US.msi`
- **NSIS Installer:** `src-tauri/target/release/bundle/nsis/SoulNotes_0.1.0_x64-setup.exe`

### Build Process

The build process:
1. Runs `next build` to create the Next.js production build
2. Copies static assets (CSS, fonts) to the correct location via `scripts/copy-static.js`
3. Compiles the Tauri Rust backend
4. Bundles everything into a standalone Windows executable

> **Note:** First build may take 5-10 minutes as Rust compiles all dependencies. Subsequent builds are much faster.

## LLM Providers

SoulNotes supports two LLM providers:

### Ollama (Default)

The default provider. Use it with a local or remote Ollama server.

### OpenAI-Compatible

Use any server that implements the OpenAI `/v1/chat/completions` API, including:

- **llama.cpp** — Local inference server
- **LM Studio** — GUI for running local models
- **vLLM** — High-throughput serving
- **text-generation-webui** — Popular local LLM UI
- **Any OpenAI-compatible endpoint** — Including OpenAI itself, Azure OpenAI, etc.

Set `LLM_PROVIDER=openai-compatible` in your environment or config, and configure the base URL and optional API token.

> **Note:** When using OpenAI-compatible provider, you must specify model names for each function (translate, summarize, conversation). These default to empty strings and will throw an error if not set.

### Switching Providers

**Desktop (Tauri):** Use the Settings UI to select your provider and configure base URL, API token, and model names.

**Web/Docker:** Set `LLM_PROVIDER` in your `.env.local` or `config.yml`:

```bash
# Use Ollama (default)
LLM_PROVIDER=ollama

# Use an OpenAI-compatible server
LLM_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=http://127.0.0.1:8080
OPENAI_COMPATIBLE_TRANSLATE_MODEL=my-translate-model
OPENAI_COMPATIBLE_SUMMARIZE_MODEL=my-summarize-model
OPENAI_COMPATIBLE_CONVERSATION_MODEL=my-chat-model
```

## Docker

```bash
# Build the image
docker build -t soulnotes:latest .

# Run with Ollama (default)
docker run --rm -p 3000:3000 \
  -e SPEACHES_BASE_URL=http://127.0.0.1:10300 \
  -e SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3 \
  -e SPEACHES_TRANSCRIBE_LANGUAGE=zh \
  -e OLLAMA_BASE_URL=http://127.0.0.1:10102 \
  -e OLLAMA_TRANSLATE_MODEL=aya-expanse:latest \
  -e OLLAMA_SUMMARIZE_MODEL=phi4:latest \
  -e OLLAMA_CONVERSATION_MODEL=aya-expanse:latest \
  -e NEXT_PUBLIC_SPEACHES_BASE_URL=http://127.0.0.1:10300 \
  -e NEXT_PUBLIC_SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3 \
  -e NEXT_PUBLIC_SPEACHES_TTS_MODEL=kokoro-tts \
  soulnotes:latest

# Run with OpenAI-compatible provider
docker run --rm -p 3000:3000 \
  -e LLM_PROVIDER=openai-compatible \
  -e OPENAI_COMPATIBLE_BASE_URL=http://127.0.0.1:8080 \
  -e OPENAI_COMPATIBLE_TRANSLATE_MODEL=my-translate-model \
  -e OPENAI_COMPATIBLE_SUMMARIZE_MODEL=my-summarize-model \
  -e OPENAI_COMPATIBLE_CONVERSATION_MODEL=my-chat-model \
  -e SPEACHES_BASE_URL=http://127.0.0.1:10300 \
  -e SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3 \
  -e SPEACHES_TRANSCRIBE_LANGUAGE=zh \
  -e NEXT_PUBLIC_SPEACHES_BASE_URL=http://127.0.0.1:10300 \
  -e NEXT_PUBLIC_SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3 \
  -e NEXT_PUBLIC_SPEACHES_TTS_MODEL=kokoro-tts \
  soulnotes:latest
```

## Environment Variables

Create a `.env.local` file with the following variables:

### Provider Selection

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider: `ollama` or `openai-compatible` | `ollama` |

### Ollama Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://127.0.0.1:10102` |
| `OLLAMA_API_TOKEN` | Ollama API token (optional) | (none) |
| `OLLAMA_TRANSLATE_MODEL` | Translation model | `aya-expanse:latest` |
| `OLLAMA_SUMMARIZE_MODEL` | Summarization model | `phi4:latest` |
| `OLLAMA_CONVERSATION_MODEL` | AI conversation partner model | `aya-expanse:latest` |

### OpenAI-Compatible Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_COMPATIBLE_BASE_URL` | OpenAI-compatible API endpoint | `http://127.0.0.1:8080` |
| `OPENAI_COMPATIBLE_API_TOKEN` | API token (optional) | (none) |
| `OPENAI_COMPATIBLE_TRANSLATE_MODEL` | Translation model | (must set) |
| `OPENAI_COMPATIBLE_SUMMARIZE_MODEL` | Summarization model | (must set) |
| `OPENAI_COMPATIBLE_CONVERSATION_MODEL` | Conversation model | (must set) |

### Speech/Transcription Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SPEACHES_BASE_URL` | Speeches API endpoint (server) | `http://127.0.0.1:10300` |
| `SPEACHES_TRANSCRIBE_MODEL` | Transcription model | `Systran/faster-whisper-large-v3` |
| `SPEACHES_TRANSCRIBE_LANGUAGE` | Source language code | `zh` |

### Client-side Variables (NEXT_PUBLIC_ prefix)

These variables are exposed to the browser and are required for realtime transcription and TTS:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SPEACHES_BASE_URL` | Speeches API endpoint (client) | `http://127.0.0.1:10300` |
| `NEXT_PUBLIC_SPEACHES_TRANSCRIBE_MODEL` | Realtime transcription model | `Systran/faster-whisper-large-v3` |
| `NEXT_PUBLIC_SPEACHES_TTS_MODEL` | Text-to-speech model | `kokoro-tts` |

## API Endpoints

- `POST /api/transcribe` - Transcribe audio file
- `POST /api/translate` - Translate text between languages
- `POST /api/summarize` - Summarize text content
- `POST /api/conversation` - AI conversation partner endpoint
- `GET /api/config` - Get frontend configuration

## Usage

1. Select the source language from the dropdown
2. Click "Start Recording" to begin capturing audio
3. Speak into your microphone - transcription appears in real-time
4. Translation displays alongside the transcript
5. Stop recording to generate a summary

## Customizing Prompts

SoulNotes uses customizable prompts for translation and summarization. You can modify these in your `config.yml` file.

### Available Placeholders

| Placeholder | Description | Used In |
|-------------|-------------|---------|
| `{source_language}` | Source language name (e.g., "Chinese", "English") | Translation |
| `{target_language}` | Target language name (e.g., "English", "French") | Translation |
| `{text}` | The content to process | Translation, Summarization |

### Summarization Prompt Features

The default summarization prompt includes:

- **Content Type Detection**: Automatically identifies if content is a meeting, lecture, interview, personal notes, or discussion
- **Proactive Elements**:
  - Deadlines & time references extraction
  - Decision tracking with context and impact
  - Open questions and follow-ups
  - Actionable recommendations
- **Context Capture**:
  - Speaker identification and attribution
  - Technical terms and concepts extraction
  - Tone and urgency assessment

### Translation Prompt Features

The default translation prompt includes:

- **Context-Aware Translation**: Preserves meaning and intent, not just words
- **Technical Term Handling**: Keeps domain-specific terms in original form with context
- **Speaker Attribution**: Maintains speaker labels in multi-speaker content
- **Idiom Handling**: Translates idioms to closest equivalents or provides context
- **Structure Preservation**: Maintains paragraphs, bullets, and formatting

### Example Custom Prompts

#### Simple Translation Prompt
```yaml
translate_prompt: "Translate the following text from {source_language} to {target_language}. Provide a natural, fluent translation:\n\n{text}"
```

#### Meeting-Focused Summary Prompt
```yaml
summarize_prompt: |
  Create a meeting summary for the following transcript.
  
  # Meeting Summary
  
  ## Attendees
  - [List participants if identifiable]
  
  ## Discussion Points
  - [Key topics discussed]
  
  ## Decisions
  - [Decisions made]
  
  ## Action Items
  - [ ] [Action] - [Owner] - [Due date]
  
  Transcript:
  {text}
```

### Prompt Best Practices

1. **Be Specific**: Clear instructions produce better results
2. **Use Structure**: Structured output formats are easier to parse
3. **Include Examples**: For complex outputs, include example format
4. **Test Iteratively**: Refine prompts based on actual output quality
5. **Model Considerations**: Larger models handle complex prompts better; simpler prompts may work better for smaller models