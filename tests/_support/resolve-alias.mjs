// Module resolution hook for the unit tests. It maps the `@/` alias used in
// src/ onto the src/ directory, lets the extensionless relative imports the
// Next.js bundler accepts resolve under plain Node, and substitutes a small
// stub for the two server-only modules that only exist to construct
// privileged clients. A test injects its own fake Supabase client and Stripe
// client, so those defaults must never run; the stubs throw if a code path
// reaches them by mistake.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcRoot = new URL("../../src/", import.meta.url);
const stubRoot = new URL("./stubs/", import.meta.url);
const extensions = [".js", ".mjs", ".jsx", ".ts", ".tsx"];

function isFile(url) {
  try {
    return existsSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

function withExtension(base) {
  if (isFile(base)) {
    return base;
  }

  for (const extension of extensions) {
    const candidate = new URL(`${base.href}${extension}`);

    if (isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2);
    const stub = new URL(`${relativePath}.js`, stubRoot);

    if (isFile(stub)) {
      return nextResolve(stub.href, context);
    }

    const target = withExtension(new URL(relativePath, srcRoot));

    if (!target) {
      throw new Error(`Cannot resolve test alias ${specifier}`);
    }

    return nextResolve(target.href, context);
  }

  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const parentInSrc = context.parentURL?.startsWith(srcRoot.href);

  if (isRelative && parentInSrc) {
    const target = withExtension(new URL(specifier, context.parentURL));

    if (target) {
      return nextResolve(target.href, context);
    }
  }

  // Next's entry points ("next/link", "next/navigation") are extensionless
  // CommonJS files without an exports map, which the bundler resolves and
  // plain Node's ESM resolver does not.
  if (/^next\/[\w-]+$/.test(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }

  return nextResolve(specifier, context);
}

// The repository's own .js files are ES modules but package.json declares no
// "type", so plain Node would treat them as CommonJS on versions without
// module syntax detection and needs no flag on versions that have it. Fixing
// the format here keeps `npm test` independent of that flag, which newer Node
// releases reject.
//
// JSX files are compiled with the TypeScript compiler the project already
// uses for typechecking, so a test can render a component with
// react-dom/server and assert on its markup instead of its source text.
export async function load(url, context, nextLoad) {
  if (/\.(jsx|tsx)$/.test(url) && !url.includes("/node_modules/")) {
    const { readFile } = await import("node:fs/promises");
    const { default: ts } = await import("typescript");
    const source = await readFile(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });

    return { format: "module", source: outputText, shortCircuit: true };
  }

  if (url.endsWith(".js") && !url.includes("/node_modules/")) {
    const result = await nextLoad(url, { ...context, format: "module" });
    return { ...result, format: "module" };
  }

  return nextLoad(url, context);
}
