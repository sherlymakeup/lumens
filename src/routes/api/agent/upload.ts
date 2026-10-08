import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Novita } from "novita-sandbox";
import {
  MAX_UPLOAD_BYTES,
  buildWriteCommand,
  sanitizeUploadName,
  uploadPath,
} from "@/lib/agent-upload";
import { SandboxSession, type SandboxLike } from "@/lib/agent-sandbox";

const Body = z.object({
  sandboxId: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(255),
  mime: z.string().max(120).optional().default(""),
  base64: z.string().min(1),
});

export const Route = createFileRoute("/api/agent/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const novitaKey = process.env.NOVITA_API_KEY?.trim() ?? "";
        if (!novitaKey) {
          return Response.json(
            { error: "Sandbox belum dikonfigurasi: set NOVITA_API_KEY di environment server." },
            { status: 503 },
          );
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json().catch(() => null));
        } catch {
          return Response.json({ error: "Body tidak valid." }, { status: 400 });
        }

        // base64 ~4/3 dari ukuran asli; tolak sebelum tulis ke sandbox
        const approxBytes = Math.floor((parsed.base64.length * 3) / 4);
        if (approxBytes > MAX_UPLOAD_BYTES) {
          return Response.json(
            { error: `File terlalu besar (maks ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` },
            { status: 413 },
          );
        }

        const name = sanitizeUploadName(parsed.name);
        const path = uploadPath(name);

        const novita = new Novita({ apiKey: novitaKey });
        const templateId = process.env.NOVITA_TEMPLATE_ID?.trim() || "base";
        const session = new SandboxSession(
          {
            sandbox: {
              connect: (id) => novita.sandbox.connect(id) as Promise<SandboxLike>,
              create: (opts) => novita.sandbox.create(opts) as Promise<SandboxLike>,
            },
          },
          templateId,
          Date.now,
          parsed.sandboxId,
        );

        const cmd = buildWriteCommand(path, parsed.base64);
        let result;
        try {
          result = await session.run(cmd, 60_000);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Gagal menulis file ke sandbox." },
            { status: 502 },
          );
        }
        if (result.exitCode !== 0) {
          return Response.json(
            { error: `Gagal menulis file: ${result.stderr.slice(0, 200)}` },
            { status: 502 },
          );
        }

        return Response.json({
          ok: true,
          sandboxId: session.sandboxId,
          attachment: { name, path, mime: parsed.mime || "application/octet-stream", size: approxBytes },
        });
      },
    },
  },
});
