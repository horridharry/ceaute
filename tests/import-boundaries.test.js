import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This test enforces the module boundaries described in
// docs/architecture.md: no "@/app/" specifier anywhere, src/features,
// src/components and src/lib never reach into src/app, provider-dashboard
// sections stay independent of one another, route groups do not import each
// other's route-private modules, and the removed "catalog" umbrella concept
// does not reappear. The checks are written as small pure functions over
// plain data (file path + source text) so each rule can be proven with an
// in-test fixture before it is run against the real tree.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CODE_EXTENSION_PATTERN = /\.(js|jsx|ts|tsx)$/;

// --- specifier extraction -------------------------------------------------

const IMPORT_FROM_PATTERN =
  /\b(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/g;
const BARE_IMPORT_PATTERN = /\bimport\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*["']([^"']+)["']/g;

function extractSpecifiers(source) {
  const specifiers = new Set();
  for (const pattern of [
    IMPORT_FROM_PATTERN,
    BARE_IMPORT_PATTERN,
    DYNAMIC_IMPORT_PATTERN,
  ]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      specifiers.add(match[1]);
      match = pattern.exec(source);
    }
  }
  return [...specifiers];
}

// Resolves a specifier written in `fromRelPath` (a repo-relative, posix-style
// path) to another repo-relative posix path. Returns null for a bare package
// specifier ("react", "next/navigation", "node:fs", ...), which this test
// has no boundary opinion about.
function resolveSpecifier(specifier, fromRelPath) {
  if (specifier.startsWith(".")) {
    const dir = path.posix.dirname(fromRelPath);
    return path.posix.normalize(path.posix.join(dir, specifier));
  }
  if (specifier.startsWith("@/")) {
    return path.posix.join("src", specifier.slice(2));
  }
  return null;
}

function isUnderOrEqual(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}/`);
}

// --- rule 1: no "@/app/" specifier ---------------------------------------

function ruleNoAppAlias(files) {
  const violations = [];
  for (const file of files) {
    for (const specifier of file.specifiers) {
      if (specifier.startsWith("@/app/")) {
        violations.push(`${file.path} -> ${specifier}`);
      }
    }
  }
  return violations;
}

// --- rule 2: src/features, src/components, src/lib never import src/app --

const APP_FORBIDDEN_ROOTS = ["src/features", "src/components", "src/lib"];

function ruleSharedCodeDoesNotImportApp(files) {
  const violations = [];
  for (const file of files) {
    if (!APP_FORBIDDEN_ROOTS.some((root) => isUnderOrEqual(file.path, root))) {
      continue;
    }
    for (const specifier of file.specifiers) {
      const resolved = resolveSpecifier(specifier, file.path);
      if (resolved && isUnderOrEqual(resolved, "src/app")) {
        violations.push(`${file.path} -> ${specifier}`);
      }
    }
  }
  return violations;
}

// --- rule 3: provider-dashboard sections are independent -----------------

const DASHBOARD_ROOT = "src/app/(dashboard)/dashboard";
const DASHBOARD_SHARED_ENTRIES = new Set(["_lib", "_components"]);
// Some section folders contain nested folders that are themselves
// independent sections (docs/architecture.md constraint 6).
const NESTED_SECTION_OVERRIDES = {
  profile: ["portfolio", "preview"],
  settings: ["booking", "payments"],
};

// Pure: takes plain {name, isDirectory} entries (as from
// fs.readdirSync(dir, { withFileTypes: true })) so it can be exercised with
// a fixture as well as the real dashboard directory listing.
function deriveDashboardSections(entries) {
  const sections = [];
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    if (DASHBOARD_SHARED_ENTRIES.has(entry.name)) continue;
    const sectionRoot = `${DASHBOARD_ROOT}/${entry.name}`;
    const overrides = NESTED_SECTION_OVERRIDES[entry.name] ?? [];
    for (const child of overrides) {
      sections.push(`${sectionRoot}/${child}`);
    }
    sections.push(sectionRoot);
  }
  // Longest prefix first, so a nested override root is matched before its
  // parent section root.
  return sections.sort((a, b) => b.length - a.length);
}

function sectionForPath(relPath, sortedSectionRoots) {
  for (const root of sortedSectionRoots) {
    if (isUnderOrEqual(relPath, root)) return root;
  }
  return null;
}

function ruleDashboardSectionsAreIndependent(files, sectionRoots) {
  const sorted = [...sectionRoots].sort((a, b) => b.length - a.length);
  const violations = [];
  for (const file of files) {
    const fileSection = sectionForPath(file.path, sorted);
    if (!fileSection) continue;
    for (const specifier of file.specifiers) {
      const resolved = resolveSpecifier(specifier, file.path);
      if (!resolved) continue;
      const targetSection = sectionForPath(resolved, sorted);
      if (targetSection && targetSection !== fileSection) {
        violations.push(
          `${file.path} -> ${specifier} (${fileSection} -> ${targetSection})`,
        );
      }
    }
  }
  return violations;
}

// --- rule 4: route groups do not import each other's private modules -----

function routeGroupOf(relPath) {
  const match = relPath.match(/^src\/app\/\(([^)]+)\)\//);
  return match ? match[1] : null;
}

function ruleRouteGroupsAreIndependent(files) {
  const violations = [];
  for (const file of files) {
    const sourceGroup = routeGroupOf(file.path);
    if (!sourceGroup) continue;
    for (const specifier of file.specifiers) {
      const resolved = resolveSpecifier(specifier, file.path);
      if (!resolved) continue;
      const targetGroup = routeGroupOf(resolved);
      if (targetGroup && targetGroup !== sourceGroup) {
        violations.push(
          `${file.path} -> ${specifier} ((${sourceGroup}) -> (${targetGroup}))`,
        );
      }
    }
  }
  return violations;
}

// --- rule 5: the removed "catalog" umbrella concept does not reappear ----

function ruleNoCatalogWord(files) {
  const pattern = /catalog/i;
  const violations = [];
  for (const file of files) {
    if (pattern.test(file.path)) {
      violations.push(`${file.path} (file name)`);
    }
    if (pattern.test(file.source)) {
      violations.push(`${file.path} (file contents)`);
    }
  }
  return violations;
}

// --- real tree loading -----------------------------------------------------

function walkFiles(absDir, relDir) {
  const out = [];
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    const absPath = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(absPath, relPath));
    } else if (CODE_EXTENSION_PATTERN.test(entry.name)) {
      out.push(relPath);
    }
  }
  return out;
}

function loadFiles(relPaths) {
  return relPaths.map((relPath) => {
    const source = readFileSync(path.join(REPO_ROOT, relPath), "utf8");
    return { path: relPath, source, specifiers: extractSpecifiers(source) };
  });
}

function violationMessage(label, violations) {
  return `${label}:\n${violations.join("\n")}`;
}

// --- fixtures proving each rule catches a real violation ------------------

test("rule 1 fixture: catches a @/app/ specifier", () => {
  const clean = [
    { path: "src/features/x/y.js", specifiers: ["@/lib/z"] },
  ];
  const dirty = [
    { path: "src/features/x/y.js", specifiers: ["@/app/dashboard/z"] },
  ];

  assert.deepEqual(ruleNoAppAlias(clean), []);
  assert.deepEqual(ruleNoAppAlias(dirty), [
    "src/features/x/y.js -> @/app/dashboard/z",
  ]);
});

test("rule 2 fixture: shared code importing into src/app is caught", () => {
  const clean = [
    {
      path: "src/lib/bookings/format.js",
      specifiers: ["./helpers", "@/lib/other"],
    },
  ];
  const dirty = [
    {
      path: "src/lib/bookings/format.js",
      specifiers: ["@/app/(dashboard)/dashboard/bookings/queries"],
    },
  ];

  assert.deepEqual(ruleSharedCodeDoesNotImportApp(clean), []);
  assert.deepEqual(ruleSharedCodeDoesNotImportApp(dirty), [
    "src/lib/bookings/format.js -> @/app/(dashboard)/dashboard/bookings/queries",
  ]);
});

test("rule 3 fixture: derives section roots and catches a cross-section import", () => {
  const sectionRoots = deriveDashboardSections([
    { name: "_lib", isDirectory: true },
    { name: "_components", isDirectory: true },
    { name: "treatments", isDirectory: true },
    { name: "profile", isDirectory: true },
    { name: "settings", isDirectory: true },
    { name: "page.jsx", isDirectory: false },
  ]);

  assert.deepEqual(
    [...sectionRoots].sort(),
    [
      `${DASHBOARD_ROOT}/profile`,
      `${DASHBOARD_ROOT}/profile/portfolio`,
      `${DASHBOARD_ROOT}/profile/preview`,
      `${DASHBOARD_ROOT}/settings`,
      `${DASHBOARD_ROOT}/settings/booking`,
      `${DASHBOARD_ROOT}/settings/payments`,
      `${DASHBOARD_ROOT}/treatments`,
    ].sort(),
  );

  const clean = [
    {
      path: `${DASHBOARD_ROOT}/treatments/actions.js`,
      specifiers: ["./queries", "@/lib/forms"],
    },
    {
      path: `${DASHBOARD_ROOT}/profile/portfolio/actions.js`,
      specifiers: [`@/app/(dashboard)/dashboard/_components/status-badge`],
    },
  ];
  const dirty = [
    {
      path: `${DASHBOARD_ROOT}/treatments/actions.js`,
      specifiers: [
        `@/app/(dashboard)/dashboard/profile/portfolio/actions`,
      ],
    },
    {
      path: `${DASHBOARD_ROOT}/settings/booking/actions.js`,
      specifiers: ["../payments/queries"],
    },
  ];

  assert.deepEqual(
    ruleDashboardSectionsAreIndependent(clean, sectionRoots),
    [],
  );
  assert.deepEqual(
    ruleDashboardSectionsAreIndependent(dirty, sectionRoots),
    [
      `${DASHBOARD_ROOT}/treatments/actions.js -> @/app/(dashboard)/dashboard/profile/portfolio/actions (${DASHBOARD_ROOT}/treatments -> ${DASHBOARD_ROOT}/profile/portfolio)`,
      `${DASHBOARD_ROOT}/settings/booking/actions.js -> ../payments/queries (${DASHBOARD_ROOT}/settings/booking -> ${DASHBOARD_ROOT}/settings/payments)`,
    ],
  );
});

test("rule 4 fixture: catches a cross-route-group import", () => {
  const clean = [
    {
      path: "src/app/(dashboard)/dashboard/profile/page.jsx",
      specifiers: ["./actions", "@/lib/forms"],
    },
  ];
  const dirty = [
    {
      path: "src/app/(dashboard)/dashboard/profile/page.jsx",
      specifiers: [
        "@/app/(public-provider)/[username]/_lib/public-provider-data",
      ],
    },
  ];

  assert.deepEqual(ruleRouteGroupsAreIndependent(clean), []);
  assert.deepEqual(ruleRouteGroupsAreIndependent(dirty), [
    "src/app/(dashboard)/dashboard/profile/page.jsx -> @/app/(public-provider)/[username]/_lib/public-provider-data ((dashboard) -> (public-provider))",
  ]);
});

test("rule 5 fixture: catches the umbrella word in a name or in source", () => {
  const clean = [{ path: "src/features/storefront/format.js", source: "export const x = 1;" }];
  const dirtyName = [{ path: "src/features/catalogue/index.js", source: "" }];
  const dirtySource = [
    { path: "src/features/storefront/format.js", source: "// Catalog helpers" },
  ];

  assert.deepEqual(ruleNoCatalogWord(clean), []);
  assert.deepEqual(ruleNoCatalogWord(dirtyName), [
    "src/features/catalogue/index.js (file name)",
  ]);
  assert.deepEqual(ruleNoCatalogWord(dirtySource), [
    "src/features/storefront/format.js (file contents)",
  ]);
});

// --- the real tree ----------------------------------------------------

const allFiles = loadFiles(walkFiles(path.join(REPO_ROOT, "src"), "src"));

test("real tree: no specifier starts with @/app/", () => {
  const violations = ruleNoAppAlias(allFiles);
  assert.deepEqual(
    violations,
    [],
    violationMessage("Specifiers starting with @/app/", violations),
  );
});

test("real tree: src/features, src/components and src/lib do not import src/app", () => {
  const violations = ruleSharedCodeDoesNotImportApp(allFiles);
  assert.deepEqual(
    violations,
    [],
    violationMessage("Shared code importing into src/app", violations),
  );
});

test("real tree: provider-dashboard sections stay independent", () => {
  const dashboardAbs = path.join(REPO_ROOT, DASHBOARD_ROOT);
  const entries = readdirSync(dashboardAbs, { withFileTypes: true }).map(
    (entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }),
  );
  const sectionRoots = deriveDashboardSections(entries);
  const violations = ruleDashboardSectionsAreIndependent(
    allFiles,
    sectionRoots,
  );
  assert.deepEqual(
    violations,
    [],
    violationMessage("Cross-section dashboard imports", violations),
  );
});

test("real tree: route groups do not import each other's private modules", () => {
  const violations = ruleRouteGroupsAreIndependent(allFiles);
  assert.deepEqual(
    violations,
    [],
    violationMessage("Cross-route-group imports", violations),
  );
});

test("real tree: no source file uses the removed catalog umbrella word", () => {
  const violations = ruleNoCatalogWord(allFiles);
  assert.deepEqual(
    violations,
    [],
    violationMessage('Files using "catalog"', violations),
  );
});
