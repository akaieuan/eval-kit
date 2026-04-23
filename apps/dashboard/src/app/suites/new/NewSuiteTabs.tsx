"use client";
import { InlineHelp, Tabs, TabsContent, TabsList, TabsTrigger } from "@eval-kit/ui";
import { useState } from "react";
import { FromTranscript } from "./FromTranscript";
import { SaveDraftForm } from "./SaveDraftForm";

const BLANK_YAML = `suite:
  id: my-suite
  version: 0.1.0
  description: What this suite measures
  target_agent_type: research-agent
  dimensions_in_scope:
    - calibration
    - collaborative_performance
  tasks:
    - id: task-001
      initial_purpose: Short one-sentence intent
      overall_goal: 1–2 sentences on what success looks like
      is_distraction: false
      steps:
        - n: 1
          prompt: What do you want the agent to do?
          expected_tools: []
          golden_truth: What the agent should produce for this step to pass.
`;

export function NewSuiteTabs({ keyAvailable }: { keyAvailable: boolean }) {
  const [draft, setDraft] = useState<{ yaml: string; taskId: string } | null>(
    null,
  );

  if (draft) {
    return (
      <SaveDraftForm
        initialYaml={
          `suite:\n  id: my-suite\n  version: 0.1.0\n  description: Drafted from transcript\n  target_agent_type: research-agent\n  dimensions_in_scope:\n    - calibration\n    - collaborative_performance\n  tasks:\n` +
          draft.yaml
            .split("\n")
            .map((l) => (l ? `    ${l}` : l))
            .join("\n")
        }
        initialFilename={`${draft.taskId}.yaml`}
      />
    );
  }

  return (
    <Tabs defaultValue="transcript">
      <TabsList>
        <TabsTrigger value="transcript">From transcript (AI)</TabsTrigger>
        <TabsTrigger value="blank">Blank template</TabsTrigger>
        <TabsTrigger value="seed">From seed</TabsTrigger>
      </TabsList>

      <TabsContent value="transcript">
        <FromTranscript
          keyAvailable={keyAvailable}
          onDraftReady={(yaml, taskId) => setDraft({ yaml, taskId })}
        />
      </TabsContent>

      <TabsContent value="blank">
        <InlineHelp id="blank-suite" title="Start from the canonical template">
          A fresh suite with one empty task. Edit, then save.
        </InlineHelp>
        <div className="mt-3">
          <SaveDraftForm
            initialYaml={BLANK_YAML}
            initialFilename="my-suite.yaml"
          />
        </div>
      </TabsContent>

      <TabsContent value="seed">
        <InlineHelp id="seed-suite-info" title="Copy from the seed suite">
          Open <code>packages/seed-suite/suites/research-agent-v1.yaml</code> in
          the editor, copy a task, and paste it into a new file. A proper
          in-browser &quot;copy task from seed&quot; UI lands in v0.3.
        </InlineHelp>
      </TabsContent>
    </Tabs>
  );
}
