# openai-html-stream

This library is created to parse out HTML from an LLM response while streaming and return a ReadableStream. The ReadableStream can be returned directly from the API to stream html into the browser.

## Installation

```bash
# npm
npm install openai-html-stream
# pnpm
pnpm install openai-html-stream
# bun
bun install openai-html-stream
```

## Usage

Here is an example of how to use this library in a Next.js API route, but you can use any web framework that supports returning a ReadableStream.

```ts
// Imagine this is returned from http://localhost:3000/api/html
import { streamHtml } from "openai-html-stream";
import OpenAI from "openai";

function GET(request: Request) {
  const client = new OpenAI();

  const result = await client.chat.completions.create({
    model: "gpt-4o",
    // Make sure to set stream to true
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "Return a single standalone html file for what the user is asking for.",
      },
      { role: "user", content: "A visitor site for the Golden Gate Bridge." },
    ],
  });

  // Just wrap the openai call in streamHtml and return a response
  return new Response(streamHtml(result), {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
}
```

If you type `http://localhost:3000/api/html` in the browser, you will see the generated HTML stream in.

## Options

`streamHtml` takes an optional `options` object that can be passed in.

```ts
streamHtml(result, {
  // This will inject some html into the head of the document while it is streaming in.
  injectIntoHead:
    "<script src='https://cdn.tailwindcss.com/1.9.6/tailwind.min.css'></script>",
});
```
