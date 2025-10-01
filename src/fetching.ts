import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";

type FetchInput = string | URL | globalThis.Request;

export async function fetchJson(input: FetchInput) {
  return await (
    await fetch(input, {
      headers: {
        "User-Agent": "shock59/makemcserver",
      },
    })
  ).json();
}

export async function downloadFile(
  url: FetchInput,
  mainDirectory: string,
  relativeDestination: string
) {
  const res = await fetch(url);
  const destination = path.resolve(mainDirectory, relativeDestination);
  const fileStream = fs.createWriteStream(destination);
  const readable = Readable.fromWeb(res.body as ReadableStream);
  await finished(readable.pipe(fileStream));
}
