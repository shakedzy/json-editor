type JqModule = {
  raw: (
    input: string,
    filter: string
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

let mod: Promise<JqModule> | null = null;

async function load(): Promise<JqModule> {
  if (!mod) {
    mod = import("jq-wasm") as unknown as Promise<JqModule>;
  }
  return mod;
}

export type JqResult = { ok: true; output: string } | { ok: false; error: string };

export async function runJq(inputJson: string, filter: string): Promise<JqResult> {
  if (!filter.trim()) return { ok: true, output: inputJson };
  try {
    const jq = await load();
    const { stdout, stderr, exitCode } = await jq.raw(inputJson, filter);
    if (exitCode !== 0) {
      return { ok: false, error: stderr.trim() || `jq exited with ${exitCode}` };
    }
    return { ok: true, output: stdout.trimEnd() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
