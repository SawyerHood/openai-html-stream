import type { ChatCompletionChunk } from "openai/resources/index.mjs";

type Options = {
  injectIntoHead?: string;
};

export function streamHtml(
  stream: AsyncIterable<ChatCompletionChunk>,
  { injectIntoHead }: Options = {}
): ReadableStream<Uint8Array> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        let programResult = "";

        let startedSending = false;
        let sentIndex = 0;

        // Start writing the html
        controller.enqueue(`<!DOCTYPE html><html>`);

        for await (const chunk of stream) {
          const value = chunk.choices[0]?.delta?.content || "";

          programResult += value;

          if (startedSending) {
            const match = programResult.match(/<\/html>/);
            if (match) {
              controller.enqueue(
                programResult.slice(sentIndex, match.index! + match[0].length)
              );
              break;
            } else {
              controller.enqueue(value);
              sentIndex = programResult.length;
            }
          } else {
            const match = programResult.match(/<head>|<body>/);
            if (match) {
              const afterMatch = programResult.slice(
                match.index! + match[0].length
              );

              let newContent =
                match[0] === "<body>"
                  ? `<head>${injectIntoHead ?? ""}</head><body>` + afterMatch
                  : `<head>${injectIntoHead ?? ""}` + afterMatch;

              const endOfHtml = newContent.match(/<\/html>/);

              newContent = endOfHtml
                ? newContent.slice(0, endOfHtml.index! + endOfHtml[0].length)
                : newContent;

              programResult = `<!DOCTYPE html><html>` + newContent;
              controller.enqueue(newContent);
              sentIndex = programResult.length;
              startedSending = true;
            }
          }
        }

        if (!programResult.includes("</html>")) {
          controller.enqueue("</html>");
        }

        controller.close();
      } catch (e) {
        console.error(e);
        controller.error(e);
        controller.close();
      }
    },
  }).pipeThrough(new TextEncoderStream());
}
