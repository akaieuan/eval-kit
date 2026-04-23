// Server-only env readers. Do not import from client components.

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function reviewerIdentity(): string {
  return process.env.EVAL_KIT_REVIEWER ?? "local";
}
