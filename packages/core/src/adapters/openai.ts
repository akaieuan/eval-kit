import type { AgentAdapter, AgentRunInput, AgentRunOutput } from "./types.js";
import type { ToolCall } from "../schema.js";

export interface OpenAIAdapterOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  maxToolIterations?: number;
  baseURL?: string;
}

const DEFAULT_SYSTEM = `You are a research agent being evaluated. Use tools when they help, explain your reasoning, and flag uncertainty explicitly. When asked to do something impossible, say so — do not fabricate.`;

/**
 * OpenAI adapter. Stubs against the OpenAI SDK shape but does NOT bundle the
 * SDK — the consumer installs `openai` themselves so eval-kit stays slim.
 *
 * Usage:
 *   import OpenAI from "openai";
 *   import { createOpenAIAdapter } from "@eval-kit/core/adapters";
 *   const adapter = createOpenAIAdapter({ client: new OpenAI(), model: "gpt-5" });
 *
 * The actual API calls are the consumer's responsibility — eval-kit never
 * proxies credentials. The stub below documents the expected shape.
 */
export function createOpenAIAdapter(
  opts: OpenAIAdapterOptions & {
    client?: {
      chat: {
        completions: {
          create: (req: unknown) => Promise<unknown>;
        };
      };
    };
  } = {},
): AgentAdapter {
  const model = opts.model ?? "gpt-5";
  const maxIter = opts.maxToolIterations ?? 8;
  const systemPrompt = opts.systemPrompt ?? DEFAULT_SYSTEM;

  return {
    name: "openai",
    model,
    config: { model, maxToolIterations: maxIter },
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      if (!opts.client) {
        throw new Error(
          "OpenAI adapter requires a client. Pass `{ client: new OpenAI() }` when constructing. See /docs/adapters for the full example.",
        );
      }
      // Skeleton loop — consumers who want to adapt this to their own OpenAI
      // tool-use patterns copy this file and specialize. eval-kit's value is
      // the schema + runner + scoring, not the tool-call glue.
      const started = Date.now();
      const tools = input.expected_tools.map((name) => ({
        type: "function" as const,
        function: {
          name,
          description: `Tool "${name}" expected by eval-kit for this step.`,
          parameters: { type: "object", additionalProperties: true },
        },
      }));
      const messages: Array<Record<string, unknown>> = [
        { role: "system", content: systemPrompt },
      ];
      for (const prior of input.prior_steps) {
        messages.push({ role: "user", content: prior.prompt });
        messages.push({ role: "assistant", content: prior.final_output });
      }
      messages.push({
        role: "user",
        content:
          input.prompt +
          (input.context.length > 0
            ? `\n\nContext:\n${input.context.map((c) => `- ${c.label} (${c.ref})`).join("\n")}`
            : ""),
      });

      const tool_calls: ToolCall[] = [];
      let finalText = "";

      for (let i = 0; i < maxIter; i += 1) {
        const resp = (await opts.client.chat.completions.create({
          model,
          messages,
          tools: tools.length ? tools : undefined,
        })) as {
          choices: Array<{
            message: {
              content: string | null;
              tool_calls?: Array<{
                id: string;
                function: { name: string; arguments: string };
              }>;
            };
            finish_reason: string;
          }>;
        };

        const choice = resp.choices[0];
        if (!choice) break;
        const msg = choice.message;
        finalText = msg.content ?? finalText;

        if (!msg.tool_calls || msg.tool_calls.length === 0) break;

        messages.push({
          role: "assistant",
          content: msg.content,
          tool_calls: msg.tool_calls,
        });
        for (const tc of msg.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            /* ignore */
          }
          const result = { ok: true, mock: true };
          tool_calls.push({ tool: tc.function.name, args, result });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        if (choice.finish_reason === "stop") break;
      }

      return {
        tool_calls,
        final_output: finalText,
        latency_ms: Date.now() - started,
      };
    },
  };
}
