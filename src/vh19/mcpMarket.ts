/**
 * VH-19 — the MCP market (19.7.0).
 *
 * Users add ANY Model Context Protocol server they want. The market keeps
 * three things honest:
 *
 *   • a CURATED CATALOG of well-known reference servers (name, what it does,
 *     how it launches) — provenance stated, nothing downloaded by the UI;
 *   • a LOCAL REGISTRY of the user's installed servers — command + args or
 *     HTTP URL, env keys recorded BY NAME only (never values), zod-validated;
 *   • an EXPORT that emits a standard `mcpServers` JSON config the real
 *     hosts consume (tools/mcp.mjs, the desktop shell, any MCP client).
 *
 * Honesty floor: the browser registry does not secretly spawn processes.
 * A stdio server is "installed and exported — executes under the host";
 * an HTTP server is validated against the SAME SSRF egress guard every
 * provider call passes, and is "registered — the host bridges calls".
 */

import { z } from "zod";
import { checkEgressUrl } from "../security/guardrail";

const REGISTRY_KEY = "vh19.mcpmarket.v1";

/* ── the curated catalog ────────────────────────────────────────────────── */

export interface CatalogServer {
  id: string;
  name: string;
  category: string;
  description: string;
  transport: "stdio" | "http";
  /** stdio launch shape */
  command?: string;
  args?: string[];
  /** http shape */
  url?: string;
  /** env var NAMES the server reads — values are supplied by the user at run time */
  envNames?: string[];
}

export const MCP_CATALOG: CatalogServer[] = [
  { id: "filesystem", name: "Filesystem", category: "workspace", description: "Read/write/search files under a rooted directory you name.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "<ROOT>"] },
  { id: "git", name: "Git", category: "workspace", description: "Repo status, diffs, log and commits through MCP tools.", transport: "stdio", command: "uvx", args: ["mcp-server-git", "--repository", "<PATH>"] },
  { id: "github", name: "GitHub", category: "devtools", description: "Issues, PRs, repos and search via the official GitHub MCP server.", transport: "http", url: "https://api.githubcopilot.com/mcp/", envNames: ["GITHUB_PERSONAL_ACCESS_TOKEN"] },
  { id: "postgres", name: "PostgreSQL", category: "data", description: "Read-only SQL queries against a Postgres connection string.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres", "<CONNECTION_STRING>"] },
  { id: "sqlite", name: "SQLite", category: "data", description: "Schema inspection and read/write SQL on a local .db file.", transport: "stdio", command: "uvx", args: ["mcp-server-sqlite", "--db-path", "<PATH>"] },
  { id: "brave-search", name: "Brave Search", category: "web", description: "Web and local search; needs a Brave API key.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], envNames: ["BRAVE_API_KEY"] },
  { id: "webfetch", name: "Web Fetch", category: "web", description: "Fetch a page and extract readable markdown from it.", transport: "stdio", command: "uvx", args: ["mcp-server-fetch"] },
  { id: "memory", name: "Memory", category: "knowledge", description: "A persistent knowledge-graph memory for the crew.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] },
  { id: "sequentialthinking", name: "Sequential Thinking", category: "reasoning", description: "Structured step-by-step reasoning scaffolding for hard tasks.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
  { id: "time", name: "Time", category: "utility", description: "Current time and conversions across timezones.", transport: "stdio", command: "uvx", args: ["mcp-server-time"] },
  { id: "slack", name: "Slack", category: "comms", description: "Channels, history and messages via a Slack bot token.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-slack"], envNames: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"] },
  { id: "puppeteer", name: "Puppeteer Browser", category: "web", description: "Drive a real headless browser: navigate, click, screenshot.", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] },
];

/* ── the local registry ─────────────────────────────────────────────────── */

export const McpServerSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  transport: z.enum(["stdio", "http"]),
  command: z.string().max(400).optional(),
  args: z.array(z.string().max(400)).max(32).optional(),
  url: z.string().max(600).optional(),
  envNames: z.array(z.string().max(120)).max(16).optional(),
  enabled: z.boolean(),
  addedAt: z.string(),
  fromCatalog: z.string().max(80).nullable(),
  note: z.string().max(400).optional(),
});

export type McpServer = z.infer<typeof McpServerSchema>;

export type InstallResult =
  | { ok: true; server: McpServer }
  | { ok: false; refusal: string };

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/* No storage (plain Node, sandboxed quirks) ⇒ the registry lives in this
 * module's memory for the process lifetime — stated, not hidden. */
let memRegistry: McpServer[] | null = null;

function loadRegistry(): McpServer[] {
  const s = storage();
  if (!s) {
    if (!memRegistry) memRegistry = [];
    return memRegistry;
  }
  try {
    const raw = JSON.parse(s.getItem(REGISTRY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) { if (!memRegistry) memRegistry = []; return memRegistry; }
    const parsed = raw.map((r) => McpServerSchema.safeParse(r)).filter((r) => r.success).map((r) => r.data);
    memRegistry = parsed;
    return parsed;
  } catch {
    if (!memRegistry) memRegistry = [];
    return memRegistry;
  }
}

function saveRegistry(list: McpServer[]): void {
  memRegistry = list;
  const s = storage();
  if (!s) return;
  try { s.setItem(REGISTRY_KEY, JSON.stringify(list.slice(0, 64))); } catch { /* quota — memory copy stands */ }
}

export function catalogServers(): CatalogServer[] {
  return MCP_CATALOG.map((c) => ({ ...c }));
}

export function listInstalled(): McpServer[] {
  return loadRegistry();
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "server";
}

/** Install from the catalog or a user form. Every refusal is in words. */
export function installServer(input: {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  envNames?: string[];
  fromCatalogId?: string;
  note?: string;
}, now: () => Date = () => new Date()): InstallResult {
  const name = input.name.trim();
  if (!name) return { ok: false, refusal: "a server needs a name — nothing was installed" };

  const reg = loadRegistry();
  if (reg.length >= 64) return { ok: false, refusal: "the local registry is capped at 64 servers — remove one first" };

  let candidate: McpServer;

  if (input.transport === "http") {
    const url = (input.url ?? "").trim();
    if (!url) return { ok: false, refusal: "an HTTP MCP server needs a URL — nothing was installed" };
    const egress = checkEgressUrl(url);
    if (!egress.ok) return { ok: false, refusal: `URL refused by the same SSRF egress guard every provider call passes: ${egress.reason}` };
    candidate = {
      id: slugify(name), name, transport: "http", url, enabled: true,
      envNames: (input.envNames ?? []).map((v) => v.trim()).filter(Boolean).slice(0, 16),
      addedAt: now().toISOString(), fromCatalog: input.fromCatalogId ?? null, note: input.note?.slice(0, 400),
    };
  } else {
    const command = (input.command ?? "").trim();
    if (!command) return { ok: false, refusal: "a stdio MCP server needs a command to launch — nothing was installed" };
    if (/^sudo\b/.test(command) || /\brm\s+-rf\b/.test(command)) {
      return { ok: false, refusal: "this command shape is refused at the market — register it with your host directly if you truly mean it" };
    }
    candidate = {
      id: slugify(name), name, transport: "stdio", command,
      args: (input.args ?? []).map((v) => String(v).trim()).filter(Boolean).slice(0, 32),
      enabled: true,
      envNames: (input.envNames ?? []).map((v) => v.trim()).filter(Boolean).slice(0, 16),
      addedAt: now().toISOString(), fromCatalog: input.fromCatalogId ?? null, note: input.note?.slice(0, 400),
    };
  }

  const parsed = McpServerSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, refusal: `the record did not validate: ${parsed.error.issues[0]?.message ?? "unknown field error"}` };

  const existing = reg.findIndex((r) => r.id === candidate.id);
  if (existing >= 0) reg[existing] = candidate; else reg.push(candidate);
  saveRegistry(reg);
  return { ok: true, server: candidate };
}

export function uninstallServer(id: string): boolean {
  const reg = loadRegistry();
  const next = reg.filter((r) => r.id !== id);
  if (next.length === reg.length) return false;
  saveRegistry(next);
  return true;
}

export function setServerEnabled(id: string, enabled: boolean): McpServer | null {
  const reg = loadRegistry();
  const at = reg.findIndex((r) => r.id === id);
  if (at === -1) return null;
  reg[at] = { ...reg[at], enabled };
  saveRegistry(reg);
  return reg[at];
}

/**
 * The standard `mcpServers` export — the shape tools/mcp.mjs, the desktop
 * shell and every MCP client config accepts. Env values are NEVER present;
 * the export names them and the host resolves them from its own keychain.
 */
export function exportMcpJson(): { mcpServers: Record<string, { command?: string; args?: string[]; url?: string; env?: Record<string, string> }> } {
  const out: Record<string, { command?: string; args?: string[]; url?: string; env?: Record<string, string> }> = {};
  for (const s of loadRegistry()) {
    if (!s.enabled) continue;
    if (s.transport === "http") {
      out[s.id] = { url: s.url };
    } else {
      out[s.id] = { command: s.command, args: s.args ?? [] };
    }
    if (s.envNames && s.envNames.length) {
      out[s.id].env = Object.fromEntries(s.envNames.map((n) => [n, `$${n}`]));
    }
  }
  return { mcpServers: out };
}

export function marketStats(): { catalog: number; installed: number; enabled: number } {
  const reg = loadRegistry();
  return { catalog: MCP_CATALOG.length, installed: reg.length, enabled: reg.filter((r) => r.enabled).length };
}

export function clearMarket(): void {
  const s = storage();
  if (s) s.removeItem(REGISTRY_KEY);
  memRegistry = null;
}
