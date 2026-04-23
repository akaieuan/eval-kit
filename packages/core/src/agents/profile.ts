import { z } from "zod";
import {
  createAnthropicAdapter,
  type ToolDefinition,
} from "../adapters/anthropic.js";
import { createHttpAdapter } from "../adapters/http.js";
import { createMockAdapter } from "../adapters/mock.js";
import type { AgentAdapter } from "../adapters/types.js";

/**
 * AgentProfile — a zero-code, YAML-defined description of an agent.
 * Captures everything needed to construct an AgentAdapter without the user
 * writing TypeScript: which backend, which model, system prompt, tools.
 */

export const AgentProfileTool = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.record(z.unknown()).optional(),
});
export type AgentProfileTool = z.infer<typeof AgentProfileTool>;

const AnthropicAgent = z.object({
  based_on: z.literal("anthropic"),
  model: z.string().default("claude-sonnet-4-5"),
  system_prompt: z.string().optional(),
  tools: z.array(AgentProfileTool).default([]),
  max_tool_iterations: z.number().int().positive().max(32).optional(),
  max_tokens: z.number().int().positive().max(16384).optional(),
  api_key_env: z.string().optional(),
});

const OpenAiAgent = z.object({
  based_on: z.literal("openai"),
  model: z.string(),
  system_prompt: z.string().optional(),
  tools: z.array(AgentProfileTool).default([]),
  max_tool_iterations: z.number().int().positive().max(32).optional(),
  api_key_env: z.string().optional(),
  base_url: z.string().url().optional(),
});

const HttpAgent = z.object({
  based_on: z.literal("http"),
  url: z.string().url(),
  model: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

const MockAgent = z.object({
  based_on: z.literal("mock"),
  model: z.string().default("mock-1"),
  degraded: z.boolean().optional(),
});

export const AgentBackend = z.discriminatedUnion("based_on", [
  AnthropicAgent,
  OpenAiAgent,
  HttpAgent,
  MockAgent,
]);
export type AgentBackend = z.infer<typeof AgentBackend>;

const AgentMeta = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/i, "id must be kebab-case alphanumerics"),
  name: z.string(),
  description: z.string().optional(),
});

export const AgentProfile = z.object({
  agent: z.intersection(AgentMeta, AgentBackend),
});
export type AgentProfile = z.infer<typeof AgentProfile>;

export function parseAgentProfile(input: unknown): AgentProfile {
  return AgentProfile.parse(input);
}

/**
 * Build an AgentAdapter from a validated profile. The profile carries all
 * options; the returned adapter's `.name` is the profile id for clarity in
 * run artifacts.
 */
export function adapterFromProfile(profile: AgentProfile): AgentAdapter {
  const a = profile.agent;

  if (a.based_on === "anthropic") {
    const toolDefinitions = a.tools.length
      ? Object.fromEntries(
          a.tools.map((t) => [
            t.name,
            {
              description: t.description ?? `Tool "${t.name}"`,
              input_schema: (t.input_schema ?? {
                type: "object",
                additionalProperties: true,
              }) as Record<string, unknown>,
            } satisfies ToolDefinition,
          ]),
        )
      : undefined;
    const apiKey = a.api_key_env
      ? process.env[a.api_key_env]
      : process.env.ANTHROPIC_API_KEY;
    const underlying = createAnthropicAdapter({
      apiKey,
      model: a.model,
      systemPrompt: a.system_prompt,
      maxToolIterations: a.max_tool_iterations,
      maxTokens: a.max_tokens,
      toolDefinitions,
    });
    return {
      ...underlying,
      name: a.id,
      config: { ...underlying.config, profile: a.id, based_on: "anthropic" },
    };
  }

  if (a.based_on === "http") {
    const underlying = createHttpAdapter({
      url: a.url,
      headers: a.headers,
      model: a.model,
      name: a.id,
    });
    return {
      ...underlying,
      config: { ...underlying.config, profile: a.id, based_on: "http" },
    };
  }

  if (a.based_on === "mock") {
    const underlying = createMockAdapter({
      model: a.model,
      degraded: a.degraded,
    });
    return {
      ...underlying,
      name: a.id,
      config: { ...underlying.config, profile: a.id, based_on: "mock" },
    };
  }

  // openai — profile-based OpenAI support requires the consumer to also pass
  // a client via code. Flag it explicitly so the error is actionable.
  throw new Error(
    `Agent profile "${a.id}" uses based_on: openai — OpenAI profiles require` +
      ` a client, which the YAML loader can't supply. For now, wrap the` +
      ` OpenAI adapter in a custom adapter file and use --adapter ./path.js.`,
  );
}
