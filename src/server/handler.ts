import { SseListener } from "./listener";

/**
 * Creates an HTTP Response for Server-Sent Events (SSE) compatible with Next.js Route Handlers.
 * Handles client registration, keep-alive pings, and resource cleanup on client disconnect.
 *
 * @param listener The active SseListener instance.
 * @param req Optional incoming Request object to listen for connection aborts.
 * @returns A Response object streaming SSE.
 */
export function createSseHandler(
  listener: SseListener,
  req?: Request,
): Response {
  const clientId = Math.random().toString(36).substring(2, 15);
  const encoder = new TextEncoder();
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    clearInterval(keepAliveInterval);
    listener.unregisterClient(clientId);

    try {
      writer.close();
    } catch (err) {
      // Stream is already closed
    }
  };

  const send = (data: string) => {
    if (isCleanedUp) return;

    writer.write(encoder.encode(data)).catch(() => {
      // Write failed, connection probably severed
      cleanup();
    });
  };

  // Register client to receive broadcasts
  listener.registerClient(clientId, send);

  // Keep-alive timer to prevent proxies (Cloud Run, Cloudflare, etc.) from timing out
  const keepAliveInterval = setInterval(() => {
    if (isCleanedUp) return;
    writer.write(encoder.encode(": keep-alive\n\n")).catch(() => {
      cleanup();
    });
  }, 20000);

  // Initial handshake to establish the client ID and current active connections count
  const handshake = {
    type: "handshake",
    clientId,
    activeConnections: listener.getActiveConnections(),
  };

  writer
    .write(
      encoder.encode(
        `event: handshake\ndata: ${JSON.stringify(handshake)}\n\n`,
      ),
    )
    .catch(() => {
      cleanup();
    });

  // Watch for request cancellation/abort
  if (req?.signal) {
    if (req.signal.aborted) {
      cleanup();
    } else {
      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    }
  }

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Turn off buffering in Nginx/Vercel
    },
  });
}
