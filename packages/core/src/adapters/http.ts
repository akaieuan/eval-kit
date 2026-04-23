import type { AgentAdapter, AgentRunInput, AgentRunOutput } from "./types.js";

export interface HttpAdapterOptions {
  /** URL of the POST endpoint that runs your agent */
  url: string;
  /** Optional static headers (e.g. auth) */
  headers?: Record<string, string>;
  /** Human-readable name shown in the dashboard */
  name?: string;
  /** Model identifier (for display + export metadata) */
  model?: string;
  /**
   * Optional request transformer. By default eval-kit POSTs AgentRunInput
   * as JSON. Use this to reshape for your backend (e.g. OpenAI-compatible,
   * your own routes).
   */
  requestBody?: (input: AgentRunInput) => unknown;
  /**
   * Optional response parser. By default eval-kit expects AgentRunOutput
   * back as JSON. Use this when your endpoint returns a different shape.
   */
  parseResponse?: (body: unknown) => AgentRunOutput;
}

/**
 * Generic HTTP adapter — point it at any endpoint that runs your agent.
 * This is the simplest path to integrating a custom / internal agent with
 * eval-kit. No SDK required.
 *
 * The endpoint receives JSON like:
 *   { prompt, context, expected_tools, prior_steps }
 *
 * And is expected to return:
 *   { tool_calls: [...], final_output: "...", latency_ms: 1234 }
 *
 * Override `requestBody` / `parseResponse` for any other shape.
 */
export function createHttpAdapter(opts: HttpAdapterOptions): AgentAdapter {
  const name = opts.name ?? "http";
  const model = opts.model ?? opts.url;
  const buildBody =
    opts.requestBody ??
    ((input: AgentRunInput) => ({
      prompt: input.prompt,
      context: input.context,
      expected_tools: input.expected_tools,
      prior_steps: input.prior_steps,
    }));
  const parse =
    opts.parseResponse ??
    ((body: unknown) => {
      const b = body as Partial<AgentRunOutput>;
      if (!b || typeof b !== "object") {
        throw new Error(
          "HTTP adapter: response body is not an object. Provide `parseResponse` to adapt your shape.",
        );
      }
      return {
        tool_calls: Array.isArray(b.tool_calls) ? b.tool_calls : [],
        final_output: typeof b.final_output === "string" ? b.final_output : "",
        latency_ms:
          typeof b.latency_ms === "number" ? b.latency_ms : 0,
      };
    });

  return {
    name,
    model,
    config: { url: opts.url, model },
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      const started = Date.now();
      const resp = await fetch(opts.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.headers ?? {}),
        },
        body: JSON.stringify(buildBody(input)),
      });
      if (!resp.ok) {
        throw new Error(
          `HTTP adapter: ${resp.status} ${resp.statusText} from ${opts.url}`,
        );
      }
      const body = await resp.json();
      const parsed = parse(body);
      // Fill in latency_ms if the endpoint didn't provide it.
      if (!parsed.latency_ms) parsed.latency_ms = Date.now() - started;
      return parsed;
    },
  };
}
