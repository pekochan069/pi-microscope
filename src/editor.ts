const WINDOWS_DRIVE_PATH = /^[A-Za-z]:[\\/]/;

export function normalizePathReference(relativePath: string): string {
  if (relativePath.length === 0) {
    throw new Error("Path reference cannot be empty");
  }

  if (WINDOWS_DRIVE_PATH.test(relativePath)) {
    throw new Error("Path reference must be relative, not absolute");
  }

  let normalized = relativePath.replaceAll("\\", "/");

  if (normalized.startsWith("/") || normalized.startsWith("//")) {
    throw new Error("Path reference must be relative, not absolute");
  }

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replaceAll(/\/+/g, "/");

  const parts = normalized.split("/");
  if (parts.some((part) => part === "..")) {
    throw new Error("Path reference cannot escape the workspace");
  }

  if (normalized.length === 0 || normalized === ".") {
    throw new Error("Path reference cannot be empty");
  }

  return normalized;
}

export function insertPathReferences(currentText: string, relativePaths: string[]): string {
  if (relativePaths.length === 0) {
    throw new Error("At least one path reference is required");
  }

  const references = relativePaths.map((path) => `@${normalizePathReference(path)}`).join(" ");

  if (currentText.length === 0 || /\s$/.test(currentText)) {
    return `${currentText}${references}`;
  }

  return `${currentText} ${references}`;
}

export function insertPathReference(currentText: string, relativePath: string): string {
  return insertPathReferences(currentText, [relativePath]);
}
