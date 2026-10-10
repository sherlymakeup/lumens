import { createFileRoute } from "@tanstack/react-router";

/** Versi deployment — dipakai client untuk deteksi update.
 *  Vercel otomatis set VERCEL_GIT_COMMIT_SHA; fallback ke timestamp build. */
export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          buildId:
            process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
            process.env.BUILD_ID ??
            "dev",
          deployedAt: new Date().toISOString(),
        });
      },
    },
  },
});
