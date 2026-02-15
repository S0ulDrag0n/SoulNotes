# SoulNotes

Real-time speech transcription, translation, and summarization application.

## Features

- **Live Speech Recognition** - Capture audio from your microphone in real-time
- **Real-time Translation** - Translate speech on-the-fly as you speak
- **Automatic Summarization** - Get structured meeting notes automatically
- **Multi-language Support** - Support for English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, and Arabic
- **Dark Mode** - Toggle between light and dark themes
- **Desktop App** - Standalone Windows executable (Tauri)

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

## Docker

```bash
# Build the image
docker build -t soulnotes:latest .

# Run the container
docker run --rm -p 3000:3000 \
  -e SPEACHES_BASE_URL=http://10.61.46.95:10300 \
  -e SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3 \
  -e SPEACHES_TRANSCRIBE_LANGUAGE=zh \
  -e OLLAMA_BASE_URL=http://10.61.46.95:10102 \
  -e OLLAMA_API_TOKEN=your_token_here \
  -e OLLAMA_TRANSLATE_MODEL=aya-expanse:latest \
  -e OLLAMA_SUMMARIZE_MODEL=phi4:latest \
  soulnotes:latest
```

## Environment Variables

Create a `.env.local` file with the following variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SPEACHES_BASE_URL` | Speeches API endpoint | `http://10.61.46.95:10300` |
| `SPEACHES_TRANSCRIBE_MODEL` | Transcription model | `Systran/faster-whisper-large-v3` |
| `SPEACHES_TRANSCRIBE_LANGUAGE` | Source language code | `zh` |
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://10.61.46.95:10102` |
| `OLLAMA_API_TOKEN` | Ollama API token | (none) |
| `OLLAMA_TRANSLATE_MODEL` | Translation model | `aya-expanse:latest` |
| `OLLAMA_SUMMARIZE_MODEL` | Summarization model | `phi4:latest` |

## API Endpoints

- `POST /api/transcribe` - Transcribe audio file
- `POST /api/translate` - Translate text between languages
- `POST /api/summarize` - Summarize text content
- `GET /api/config` - Get frontend configuration

## Usage

1. Select the source language from the dropdown
2. Click "Start Recording" to begin capturing audio
3. Speak into your microphone - transcription appears in real-time
4. Translation displays alongside the transcript
5. Stop recording to generate a summary