import { context, isSpanContextValid, trace, type SpanContext } from "@opentelemetry/api";

export type ActiveTraceContext = Readonly<{
  spanId: string;
  traceId: string;
}>;

export function getActiveTraceContext(
  spanContext: SpanContext | undefined = trace.getSpan(context.active())?.spanContext()
): ActiveTraceContext | null {
  return spanContext && isSpanContextValid(spanContext)
    ? { spanId: spanContext.spanId, traceId: spanContext.traceId }
    : null;
}
