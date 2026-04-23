import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EvalTask, type EvalTask as EvalTaskType } from "../schema.js";

const EXTRACT_SYSTEM = `You convert a real agent-user session transcript into a draft EvalTask for eval-kit.

Rules:
- Output ONLY a valid EvalTask via the emit_task tool. Do not invent details that are not in the transcript.
- The id must be kebab-case, prefixed "task-draft-", derived from the initial_purpose.
- initial_purpose is one sentence summarizing the user's stated intent.
- overall_goal is 1-2 sentences; extract from user intent, never from agent output.
- is_distraction = true ONLY if the user's request is clearly impossible/unverifiable (future-dated, out of scope). Otherwise false.
- context_items should include any @source: refs or "this PDF"/"attached" references the user made.
- steps: one per user turn in order. expected_tools = tool names the agent called that a sane research agent SHOULD use for that step. golden_truth = the expectation stated positively. If unclear from the transcript, use "[UNCERTAIN: human should fill]".
- scoring_hints.dimensions: populate via heuristics — agency_preservation when the user pushed back or the agent overrode intent; calibration when the agent hallucinated or flagged uncertainty; explainability when the agent's choices were opaque; collaborative_performance when the agent missed or caught a goal drift.
- If the transcript is too short or unclear, return a task with steps that faithfully reflect what's there — don't pad.

Be conservative. This is a draft; a human will edit it.`;

const FEW_SHOTS = `
Example transcript (trimmed):
USER: Can you read this paper [@source:gr.pdf] and give me 5 claims about general relativity?
AGENT: [calls read_pdf] Here are 5 claims...

Example emitted EvalTask:
{
  "id": "task-draft-gr-paper-read",
  "initial_purpose": "Reading a paper on general relativity to extract claims",
  "overall_goal": "Surface 5 concrete claims about general relativity from the uploaded paper, grounded in its text.",
  "is_distraction": false,
  "context_items": [{ "type": "pdf", "label": "GR paper", "ref": "@source:gr.pdf" }],
  "steps": [{
    "n": 1,
    "prompt": "Can you read this paper [@source:gr.pdf] and give me 5 claims about general relativity?",
    "expected_tools": ["read_pdf"],
    "golden_truth": "Agent surfaces 5 claims grounded in the PDF (not general GR knowledge), each with a page reference.",
    "scoring_hints": { "tool_match": "subset", "golden_truth_rubric": "0-3", "dimensions": ["calibration"] }
  }]
}
`;

export interface ExtractTaskOptions {
  apiKey?: string;
  model?: string;
}

export type ExtractTaskResult =
  | { ok: true; task: EvalTaskType }
  | { ok: false; error: string };

export async function extractTaskFromTranscript(
  transcript: string,
  opts: ExtractTaskOptions = {},
): Promise<ExtractTaskResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Set ANTHROPIC_API_KEY in .env.local at the repo root. See /docs/quickstart#env.",
    };
  }
  if (!transcript.trim()) {
    return { ok: false, error: "Transcript is empty." };
  }

  const client = new Anthropic({ apiKey });
  const model = opts.model ?? "claude-sonnet-4-5";

  const jsonSchema = zodToJsonSchema(EvalTask, {
    name: "EvalTask",
    $refStrategy: "none",
  }) as { definitions?: Record<string, unknown> } & Record<string, unknown>;
  // zod-to-json-schema wraps in definitions.EvalTask; unwrap.
  const unwrapped =
    jsonSchema.definitions?.EvalTask ??
    (jsonSchema as Record<string, unknown>);

  const tool = {
    name: "emit_task",
    description:
      "Emit a draft EvalTask that matches the schema. Prefer [UNCERTAIN] strings over fabrication.",
    input_schema: unwrapped as Anthropic.Messages.Tool.InputSchema,
  } satisfies Anthropic.Messages.Tool;

  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: EXTRACT_SYSTEM,
    },
    {
      type: "text",
      text: FEW_SHOTS,
      cache_control: { type: "ephemeral" },
    },
  ];

  async function callOnce(extra?: string): Promise<ExtractTaskResult> {
    const userContent = extra
      ? `Transcript:\n\n${transcript}\n\nPrevious attempt failed validation: ${extra}\nPlease emit a valid EvalTask.`
      : `Transcript:\n\n${transcript}`;

    const resp = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemBlocks,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_task" },
      messages: [{ role: "user", content: userContent }],
    });

    const toolBlock = resp.content.find(
      (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
    );
    if (!toolBlock) {
      return {
        ok: false,
        error: "Model did not emit a tool call. Try a longer transcript.",
      };
    }

    const parsed = EvalTask.safeParse(toolBlock.input);
    if (parsed.success) return { ok: true, task: parsed.data };
    return { ok: false, error: parsed.error.toString() };
  }

  const first = await callOnce();
  if (first.ok) return first;
  const retry = await callOnce(first.error);
  if (retry.ok) return retry;
  return {
    ok: false,
    error: `Failed to produce a valid task after one retry. Last error:\n${retry.error}`,
  };
}
