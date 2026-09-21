/**
 * mcpx tool - exposes the host machine's `mcpx` CLI to the model so it can
 * call tools/prompts/resources on any MCP server configured on the host.
 *
 * Extensions run in pi's process on the host, so spawning `mcpx` here reaches
 * the host binary and host MCP config even though bash/read/etc. are remapped
 * into the dev container by the devcontainer extension.
 */

import { spawn } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MAX_OUTPUT_BYTES = 50_000;
const DEFAULT_TIMEOUT_SECONDS = 120;

interface McpxResult {
	code: number;
	output: string;
	timedOut: boolean;
}

function runMcpx(args: string[], signal: AbortSignal | undefined, timeoutSeconds: number): Promise<McpxResult> {
	return new Promise((resolve, reject) => {
		const child = spawn("mcpx", args, { stdio: ["ignore", "pipe", "pipe"] });
		const chunks: Buffer[] = [];
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutSeconds * 1000);
		const onAbort = () => child.kill();
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout.on("data", (d) => chunks.push(d));
		child.stderr.on("data", (d) => chunks.push(d));
		child.on("error", (e) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			reject(e);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			if (signal?.aborted) {
				reject(new Error("aborted"));
				return;
			}
			resolve({ code: code ?? -1, output: Buffer.concat(chunks).toString("utf-8"), timedOut });
		});
	});
}

function truncate(text: string): string {
	if (Buffer.byteLength(text, "utf-8") <= MAX_OUTPUT_BYTES) return text;
	const buf = Buffer.from(text, "utf-8");
	const tail = buf.subarray(buf.length - MAX_OUTPUT_BYTES).toString("utf-8");
	return `[output truncated to last ${MAX_OUTPUT_BYTES} bytes]\n${tail}`;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "mcpx",
		label: "mcpx (host MCP CLI)",
		description: [
			"Run the host machine's `mcpx` CLI to interact with the user's configured MCP servers",
			"(runs on the host, not in the dev container). Pass CLI arguments as a list, without the",
			"leading `mcpx`.",
			"",
			"Common invocations:",
			'- ["server", "--list"] — show logged-in servers',
			'- ["tool", "<server>", "--help"] — list tools available on a server',
			'- ["tool", "<server>", "<tool_name>", "--help"] — detailed help for a specific tool',
			'- ["tool", "<server>", "<tool_name>", "--arg", "value", ...] — call a tool',
			'- ["prompt", ...] / ["resource", ...] — render prompts and read resources',
			"",
			"Always check a tool's --help before calling it with arguments.",
		].join("\n"),
		parameters: Type.Object({
			args: Type.Array(Type.String(), {
				description: 'mcpx CLI arguments, e.g. ["tool", "GitLab", "--help"]',
			}),
			timeout: Type.Optional(
				Type.Number({
					description: `Timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})`,
				}),
			),
		}),
		async execute(
			_toolCallId: string,
			input: { args: string[]; timeout?: number },
			signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: ExtensionContext,
		) {
			const timeoutSeconds = input.timeout ?? DEFAULT_TIMEOUT_SECONDS;
			let result: McpxResult;
			try {
				result = await runMcpx(input.args, signal, timeoutSeconds);
			} catch (e: any) {
				if (e?.code === "ENOENT") {
					return {
						content: [{ type: "text" as const, text: "mcpx binary not found on the host PATH." }],
						isError: true,
					};
				}
				throw e;
			}
			if (result.timedOut) {
				return {
					content: [
						{
							type: "text" as const,
							text: `mcpx timed out after ${timeoutSeconds}s.\n${truncate(result.output)}`,
						},
					],
					isError: true,
				};
			}
			const text = truncate(result.output) || "(no output)";
			if (result.code !== 0) {
				return {
					content: [{ type: "text" as const, text: `exit code ${result.code}\n${text}` }],
					isError: true,
				};
			}
			return { content: [{ type: "text" as const, text }] };
		},
	});
}
