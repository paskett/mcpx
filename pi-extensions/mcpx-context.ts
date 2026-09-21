import { execSync } from "node:child_process";

export default function (pi: any) {
  let injected = false;

  pi.on("before_agent_start", async (event: any) => {
    if (injected) return;
    injected = true;

    const run = (cmd: string): string | null => {
      try {
        return execSync(cmd, { encoding: "utf8", timeout: 10_000 }).trim();
      } catch {
        return null;
      }
    };

    const serverList = run("mcpx server --list");
    if (serverList === null) return; // mcpx not installed / not working

    event.systemPromptOptions.sections.mcpx_status = [
      "$ mcpx server --list",
      serverList || "(no servers logged in)",
    ].join("\n");
  });
}
