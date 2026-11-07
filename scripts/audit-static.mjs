import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const excludedDirectories = new Set([".git", "node_modules", "dist"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) return [];
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

function projectPath(absolutePath) {
  return relative(root, absolutePath).replaceAll("\\", "/");
}

function resolveLocalReference(sourceFile, rawReference) {
  const reference = rawReference.trim();
  if (
    !reference ||
    reference.startsWith("#") ||
    reference.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(reference) ||
    reference.includes("${")
  ) {
    return null;
  }

  const cleanReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  if (!cleanReference) return null;
  return cleanReference.startsWith("/")
    ? join(root, cleanReference.slice(1))
    : resolve(dirname(sourceFile), cleanReference);
}

const files = walk(root);
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html");
const jsFiles = files.filter(
  (file) => extname(file).toLowerCase() === ".js" && !projectPath(file).startsWith("assets/vendor/"),
);

const missingReferences = [];
const duplicateIds = [];

for (const file of htmlFiles) {
  const source = readFileSync(file, "utf8");
  const seenIds = new Set();

  for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    const id = match[1];
    if (seenIds.has(id)) duplicateIds.push({ file: projectPath(file), id });
    seenIds.add(id);
  }

  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const target = resolveLocalReference(file, match[1]);
    if (target && !existsSync(target)) {
      missingReferences.push({ file: projectPath(file), reference: match[1] });
    }
  }
}

for (const file of jsFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:from\s*|import\s*\()["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = resolve(dirname(file), match[1]);
    const candidates = [target, `${target}.js`, `${target}.json`, join(target, "index.js")];
    if (!candidates.some(existsSync)) {
      missingReferences.push({ file: projectPath(file), reference: match[1] });
    }
  }
}

const firebaseVersions = new Map();
for (const file of jsFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/gstatic\.com\/firebasejs\/([^/]+)/g)) {
    const version = match[1];
    firebaseVersions.set(version, [...(firebaseVersions.get(version) ?? []), projectPath(file)]);
  }
}

const report = {
  htmlFiles: htmlFiles.length,
  javascriptFiles: jsFiles.length,
  missingReferences,
  duplicateIds,
  firebaseVersions: Object.fromEntries(firebaseVersions),
};

console.log(JSON.stringify(report, null, 2));

if (missingReferences.length || duplicateIds.length || firebaseVersions.size > 1) {
  process.exitCode = 1;
}
