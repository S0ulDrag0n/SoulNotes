import ollama from 'ollama';

export async function POST(req: Request) {
  const { text } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await ollama.chat({
          model: 'llama3',
          messages: [
            { role: 'user', content: `Translate the following text to English: "${text}"` }
          ],
          stream: true,
        });

        for await (const chunk of response) {
          controller.enqueue(encoder.encode(chunk.message.content));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' },
  });
}