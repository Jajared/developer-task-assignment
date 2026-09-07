import { createApp } from "./app.ts";

const app = createApp();

/** Boots the app on an ephemeral port for the duration of one request. */
export async function request(path: string, init?: RequestInit) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (typeof address === "string" || address === null) {
      throw new Error("expected a TCP address");
    }
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    server.close();
  }
}

/** Sends a JSON body with the given method (POST by default). */
export function send(path: string, body: unknown, method = "POST") {
  return request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
