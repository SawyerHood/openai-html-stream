type Options = {
  injectIntoHead?: string;
};

export type Chunk = {
  choices: {
    delta: {
      content?: string | null;
    };
  }[];
};

export function streamHtml(
  stream: AsyncIterable<Chunk>,
  { injectIntoHead }: Options = {}
): ReadableStream<Uint8Array> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        let programResult = "";

        let startedSending = false;
        let sentIndex = 0;

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
              controller.enqueue(programResult);
              sentIndex = programResult.length;
              startedSending = true;
            }
          }
        }

        if (!startedSending) {
          controller.enqueue("<!DOCTYPE html><html>");
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
