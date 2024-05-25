import { streamHtml } from "./index.ts";
import type { ChatCompletionChunk } from "openai/resources/index.mjs";
import { expect, test, it, describe } from "@jest/globals";

function createChunkFromString(str: string): ChatCompletionChunk {
  return {
    id: "",
    choices: [
      {
        finish_reason: "stop",
        index: 0,
        delta: {
          content: str,
        },
      },
    ],
    created: 0,
    model: "",
    object: "chat.completion.chunk",
    system_fingerprint: "",
  };
}

function chunkStringIntoAsyncIterable(
  ...strings: string[]
): AsyncIterable<ChatCompletionChunk> {
  return (async function* () {
    for (const str of strings) {
      yield createChunkFromString(str);
    }
  })();
}

async function getStringFromReadableStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let str = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    str += value;
  }
  return str;
}

function chunkStringIntoArray(str: string, chunkSize: number): string[] {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

function evalDifferentSizes(
  input: string,
  cb: (stream: AsyncIterable<ChatCompletionChunk>) => any
) {
  it("works for a single chunk", async () => {
    const stream = chunkStringIntoAsyncIterable(input);
    await cb(stream);
  });

  it("works for single char chunks", async () => {
    const stream = chunkStringIntoAsyncIterable(
      ...chunkStringIntoArray(input, 1)
    );
    await cb(stream);
  });

  it("works for smaller char chunks", async () => {
    const stream = chunkStringIntoAsyncIterable(
      ...chunkStringIntoArray(input, 3)
    );
    await cb(stream);
  });

  it("works for larger char chunks", async () => {
    const stream = chunkStringIntoAsyncIterable(
      ...chunkStringIntoArray(input, 10)
    );
    await cb(stream);
  });
}

describe("streamHtml returns the html response if there is a head", () => {
  const testString =
    "<html><head></head><body><h1>Hello, world!</h1></body></html>";
  evalDifferentSizes(testString, async (stream) => {
    const html = await getStringFromReadableStream(streamHtml(stream));
    expect(html).toBe(`<!DOCTYPE html>${testString}`);
  });
});

describe("streamHtml returns the html response if there is no head", () => {
  const testString = "<html><body><h1>Hello, world!</h1></body></html>";
  evalDifferentSizes(testString, async (stream) => {
    const html = await getStringFromReadableStream(streamHtml(stream));
    expect(html).toBe(
      `<!DOCTYPE html><html><head></head><body><h1>Hello, world!</h1></body></html>`
    );
  });
});

describe("streamHtml returns an empty html page if the stream has no html", () => {
  const testString = "Hello World. Let's delve into the world of AI.";
  evalDifferentSizes(testString, async (stream) => {
    const html = await getStringFromReadableStream(streamHtml(stream));
    expect(html).toBe("<!DOCTYPE html><html></html>");
  });
});

describe("streamHtml injects a string into the head of the html", () => {
  const testString =
    "<html><head></head><body><h1>Hello, world!</h1></body></html>";
  evalDifferentSizes(testString, async (stream) => {
    const html = await getStringFromReadableStream(
      streamHtml(stream, {
        injectIntoHead: '<script src="/index.js"></script>',
      })
    );
    expect(html).toBe(
      `<!DOCTYPE html><html><head><script src="/index.js"></script></head><body><h1>Hello, world!</h1></body></html>`
    );
  });
});

describe("streamHtml inserts the head if it isn't there when injecting", () => {
  const testString = "<html><body><h1>Hello, world!</h1></body></html>";
  evalDifferentSizes(testString, async (stream) => {
    const html = await getStringFromReadableStream(
      streamHtml(stream, {
        injectIntoHead: '<script src="/index.js"></script>',
      })
    );
    expect(html).toBe(
      `<!DOCTYPE html><html><head><script src="/index.js"></script></head><body><h1>Hello, world!</h1></body></html>`
    );
  });
});

describe("streamHtml works if there is html and prose", () => {
  const testString = `
  Hello world! This is my helpful html response
  \`\`\`
<html>
  <head>
    <title>Hello, world!</title>
  </head>
  <body>
    <h1>Hello, world!</h1>
  </body>
</html>
  \`\`\`
I hope this was helpful
  `;
  evalDifferentSizes(testString, async (stream) => {
    const html = await getStringFromReadableStream(
      streamHtml(stream, {
        injectIntoHead: `<script src="/index.js"></script>`,
      })
    );
    expect(html).toBe(
      `<!DOCTYPE html><html><head><script src="/index.js"></script>
    <title>Hello, world!</title>
  </head>
  <body>
    <h1>Hello, world!</h1>
  </body>
</html>`
    );
  });
});
