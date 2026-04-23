"use client";
import {
  Button,
  InlineHelp,
  Input,
  Textarea,
} from "@eval-kit/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveNewSuite } from "./actions";

export function SaveDraftForm({
  initialYaml,
  initialFilename,
}: {
  initialYaml: string;
  initialFilename: string;
}) {
  const router = useRouter();
  const [yaml, setYaml] = useState(initialYaml);
  const [filename, setFilename] = useState(initialFilename);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveNewSuite(filename, yaml);
      if (res.ok) {
        toast.success(`Saved ${filename}`);
        router.push("/suites");
        router.refresh();
      } else {
        toast.error("Save failed", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-3">
      <InlineHelp id="save-draft-guide" title="Review before saving">
        The draft may include <code>[UNCERTAIN]</code> markers where the model
        wasn&apos;t sure. Fill them in with real expectations before saving.
      </InlineHelp>
      <div className="space-y-1">
        <label className="text-2xs uppercase tracking-wider text-fg-muted">
          Filename
        </label>
        <Input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-2xs uppercase tracking-wider text-fg-muted">
          YAML
        </label>
        <Textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          rows={20}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setYaml(initialYaml)}
        >
          Reset to draft
        </Button>
        <Button variant="primary" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save suite"}
        </Button>
      </div>
    </div>
  );
}
