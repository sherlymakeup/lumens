// Test shim: resolve extensionless TS imports + stub browser-only modules.
// Usage: node --experimental-strip-types --import ./tests/helpers/node-shim.mjs --test tests/generate.test.mjs
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const STUBS = {
  "supabase-client": `export function getSupabase() { return null; }\n`,
};

export async function resolve(specifier, context, next) {
  // Stub browser-only modules by basename (extensionless).
  const base = specifier.split("/").pop() ?? "";
  if (STUBS[base]) {
    return { url: `stub:${base}`, shortCircuit: true };
  }
  // Resolve @/ alias ke src/.
  let resolved = specifier;
  if (specifier.startsWith("@/")) {
    const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
    resolved = path.resolve(srcDir, specifier.slice(2));
    // Coba dengan ekstensi.
    for (const ext of [".ts", ".tsx", ""]) {
      const candidate = resolved + ext;
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    // Coba sebagai direktori dengan index.
    for (const ext of [".ts", ".tsx"]) {
      const candidate = path.join(resolved, `index${ext}`);
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw new Error(`Cannot resolve @/ alias: ${specifier}`);
  }
  try {
    return await next(specifier, context);
  } catch (e) {
    // Coba tambah ekstensi .ts / .tsx untuk relative import tanpa ekstensi.
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const parentPath = fileURLToPath(context.parentURL);
      const dir = path.dirname(parentPath);
      for (const ext of [".ts", ".tsx"]) {
        const candidate = path.resolve(dir, specifier + ext);
        if (existsSync(candidate) && candidate.endsWith(".ts")) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    throw e;
  }
}

export async function load(url, context, next) {
  if (url.startsWith("stub:")) {
    const base = url.slice("stub:".length);
    return { format: "module", source: STUBS[base] ?? "", shortCircuit: true };
  }
  return next(url, context);
}
