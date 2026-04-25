export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";


export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${input}`, init);
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}


export interface SseMessage<T = unknown> {
  event: string;
  data: T;
}


export async function streamSse(
  input: string,
  init: RequestInit,
  onMessage: (message: SseMessage) => void,
) {
  const response = await fetch(`${API_BASE_URL}${input}`, init);
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Streaming is not available in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);

      if (rawEvent) {
        const parsedEvent = parseSseEvent(rawEvent);
        if (parsedEvent) {
          onMessage(parsedEvent);
        }
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      if (buffer.trim()) {
        const parsedEvent = parseSseEvent(buffer.trim());
        if (parsedEvent) {
          onMessage(parsedEvent);
        }
      }
      return;
    }
  }
}


export function parseSseEvent(rawEvent: string): SseMessage | null {
  const lines = rawEvent.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n");
  return {
    event: eventName,
    data: JSON.parse(payload) as unknown,
  };
}


async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (payload?.detail) {
      return payload.detail;
    }
  } catch {
    // Ignore JSON parsing errors and fall back to status text.
  }

  return `Request failed with status ${response.status}.`;
}
