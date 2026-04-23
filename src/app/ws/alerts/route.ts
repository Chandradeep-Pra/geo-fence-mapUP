import { alertEmitter, type LiveAlertEvent } from "@/lib/alert-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onAlert = (event: LiveAlertEvent) => {
        controller.enqueue(
          encoder.encode(`event: alert\ndata: ${JSON.stringify(event)}\n\n`),
        );
      };

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, 15000);

      alertEmitter.on("alert", onAlert);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        alertEmitter.off("alert", onAlert);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
