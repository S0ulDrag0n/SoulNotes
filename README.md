This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Docker

Build the image:

```bash
docker build -t soulnotes:latest .
```

Run with all supported parameters:

```bash
docker run --rm -p 3000:3000 \
	-e SPEACHES_BASE_URL=http://10.61.46.95:10300 \
	-e SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3 \
	-e SPEACHES_TRANSCRIBE_LANGUAGE=zh \
	-e OLLAMA_BASE_URL=http://10.61.46.95:10102 \
	-e OLLAMA_TRANSLATE_MODEL=aya-expanse:latest \
	-e OLLAMA_SUMMARIZE_MODEL=phi4:latest \
	soulnotes:latest
```

## Environment Variables

Create a `.env.local` file and set any of the following if you need to override defaults:

```bash
# Speaches (realtime + fallback)
SPEACHES_BASE_URL=http://10.61.46.95:10300
SPEACHES_TRANSCRIBE_MODEL=Systran/faster-whisper-large-v3
SPEACHES_TRANSCRIBE_LANGUAGE=zh

# Ollama translation
OLLAMA_BASE_URL=http://10.61.46.95:10102
OLLAMA_TRANSLATE_MODEL=aya-expanse:latest

# Ollama summarization
OLLAMA_SUMMARIZE_MODEL=phi4:latest
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
