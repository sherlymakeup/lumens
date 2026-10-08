import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Novita, type Sandbox } from "novita-sandbox";

const Body = z.object({
  command: z.string().min(1).max(2000),
  timeoutMs: z.number().int().min(1_000).max(60_000).optional(),
});

const MAX_OUTPUT = 20_000;

function clip(text: string): string {
  return text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + "\n…[output dipotong]" : text;
}

export const Route = createFileRoute("/api/sandbox/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // The Novita key lives on the server (Vercel env) — never in the UI.
        const apiKey = process.env.NOVITA_API_KEY?.trim() ?? "";
        if (!apiKey) {
          return Response.json(
            {
              error:
                "Sandbox belum dikonfigurasi: set NOVITA_API_KEY di environment server.",
            },
            { status: 503 },
          );
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return Response.json(
            { error: "Body harus berupa { command: string, timeoutMs?: number }." },
            { status: 400 },
          );
        }
        const command = parsed.command.trim();
        if (!command) {
          return Response.json({ error: "Command tidak boleh kosong." }, { status: 400 });
        }

        let sandbox: Sandbox | null = null;
        try {
          const novita = new Novita({ apiKey });
          const templateId = process.env.NOVITA_TEMPLATE_ID?.trim() || "base";
          sandbox = await novita.sandbox.create({ template: templateId });
          const result = await sandbox.commands.run(command, {
            timeoutMs: parsed.timeoutMs ?? 30_000,
          });
          return Response.json({
            stdout: clip(result.stdout ?? ""),
            stderr: clip(result.stderr ?? ""),
            exitCode: result.exitCode ?? 0,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Sandbox execution failed.";
          return Response.json({ error: message.slice(0, 300) }, { status: 502 });
        } finally {
          // Best-effort cleanup so idle sandboxes don't burn quota.
          await sandbox?.kill().catch(() => undefined);
        }
      },
    },
  },
});
