import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
// No matched values are printed. This is a focused repository check, not a security certification.
const staged = process.argv.includes("--staged");
const paths = execFileSync(
  "git",
  staged
    ? ["ls-files", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const files = [...new Set(paths)].sort();
const problems = [];
const localSecrets = [];
if (existsSync(".env"))
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(
      /^(?:POSTGRES_PASSWORD|JWT_SECRET|PROXY_SECRET|DEMO_PASSWORD|DEMO_ADMIN_PASSWORD|DEMO_MANAGER_PASSWORD|DEMO_MEMBER_PASSWORD)=(.+)$/,
    );
    if (match && match[1].length >= 12)
      localSecrets.push(match[1].replace(/^['"]|['"]$/g, ""));
  }
const examples = new Set([".env.example", ".env.production.example"]);
const tokens = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
];
const manifest = [];
for (const path of files) {
  if (
    !examples.has(path) &&
    /(?:^|\/)(?:\.env(?:\..*)?|next-env\.d\.ts|node_modules|\.next|dist|coverage|test-results|private-[^/]*|\.local-review|qa)(?:\/|$)|\.(?:log|pem|key|p12|pfx|db|sqlite3?)$/i.test(
      path,
    )
  )
    problems.push({
      path,
      reason: "Excluded/private/generated artifact in publication candidate",
    });
  const bytes = staged
    ? execFileSync("git", ["show", ":" + path], { maxBuffer: 20 * 1024 * 1024 })
    : readFileSync(path);
  manifest.push({
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  if (/\.jpe?g$/i.test(path)) {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8)
      problems.push({ path, reason: "Invalid JPEG file" });
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if ([0xe1, 0xed, 0xfe].includes(marker))
        problems.push({
          path,
          reason: "JPEG EXIF/IPTC/comment metadata requires inspection",
        });
      const size = bytes.readUInt16BE(offset + 2);
      if (size < 2) break;
      offset += 2 + size;
    }
    continue;
  }
  if (path.endsWith(".png")) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      const kind = bytes.toString("ascii", offset + 4, offset + 8);
      if (["tEXt", "iTXt", "zTXt", "eXIf"].includes(kind))
        problems.push({
          path,
          reason: "Screenshot metadata requires inspection",
        });
      offset += size + 12;
    }
    continue;
  }
  const text = bytes.toString("utf8");
  if (localSecrets.some((secret) => text.includes(secret)))
    problems.push({
      path,
      reason: "Matches a private local environment secret",
    });
  if (tokens.some((pattern) => pattern.test(text)))
    problems.push({ path, reason: "Potential credential/private key" });
  if (/[A-Z]:[\\/]Users[\\/][^\s`"']+/i.test(text))
    problems.push({ path, reason: "Local machine path" });
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  if (
    emails.some(
      (email) => !/@(?:[\w.-]+\.)?example(?:\.(?:com|org|net))?$/i.test(email),
    )
  )
    problems.push({
      path,
      reason: "Non-example email address requires review",
    });
}
const result = {
  scope: staged
    ? "Git index contents"
    : "Tracked and nonignored candidate files",
  files: files.length,
  problems,
  manifestSha256: createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex"),
};
console.log(JSON.stringify(result, null, 2));
if (problems.length) process.exitCode = 1;
