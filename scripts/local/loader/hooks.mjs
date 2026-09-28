// Module hooks that let the local scripts run Ceaute's real server code under
// plain Node. Unlike the unit-test resolver (tests/_support/resolve-alias.mjs),
// nothing in src/ is stubbed: the real Stripe and Supabase clients are used.
// Only three Next.js pieces that exist solely inside a request are replaced:
// `server-only`, `revalidatePath` and `after`.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcRoot = new URL("../../../src/", import.meta.url);
const stubRoot = new URL("./stubs/", import.meta.url);
const stubs = {
  "server-only": "server-only.mjs",
  "next/cache": "next-cache.mjs",
  "next/server": "next-server.mjs",
};
const extensions = [".js", ".mjs", ".jsx", ".ts", ".tsx"];

function withExtension(base) {
  if (existsSync(fileURLToPath(base))) return base;
  for (const extension of extensions) {
    const candidate = new URL(`${base.href}${extension}`);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) {
    return nextResolve(new URL(stubs[specifier], stubRoot).href, context);
  }

  const parentInSrc = context.parentURL?.startsWith(srcRoot.href);
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");

  if (specifier.startsWith("@/") || (isRelative && parentInSrc)) {
    const base = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), srcRoot)
      : new URL(specifier, context.parentURL);
    const target = withExtension(base);
    if (!target) throw new Error(`Cannot resolve ${specifier}`);
    return nextResolve(target.href, context);
  }

  return nextResolve(specifier, context);
}

// The repository's .js files are ES modules without a package "type", and
// .ts files are compiled with the project's own TypeScript, as the unit-test
// loader does.
export async function load(url, context, nextLoad) {
  if (url.startsWith(srcRoot.href) && /\.(ts|tsx|jsx)$/.test(url)) {
    const { readFile } = await import("node:fs/promises");
    const { default: ts } = await import("typescript");
    const source = await readFile(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }

  if (url.startsWith(srcRoot.href) && url.endsWith(".js")) {
    const result = await nextLoad(url, { ...context, format: "module" });
    return { ...result, format: "module" };
  }

  return nextLoad(url, context);
}
