import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// src/mission/a2aServer.ts
import { createServer } from "node:http";
import { createHash } from "node:crypto";

// src/security/guardrail.ts
var CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
var INVISIBLE_UNICODE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u{E0000}-\u{E007F}]/gu;
function sanitizeText(text, maxLen = 2e3) {
  return text.replace(CONTROL_CHARS, "").replace(INVISIBLE_UNICODE, "").slice(0, maxLen).trim();
}
var INJECTION_DETECTORS = [
  {
    code: "role-hijack",
    reason: "content tries to override the agent's role or instructions",
    test: (t) => /ignore\s+(all\s+|any\s+|previous\s+|prior\s+|above\s+)*instructions/i.test(t) || /disregard\s+(all\s+|any\s+|previous\s+|prior\s+)*instructions/i.test(t) || /you\s+are\s+now\s+(a|an|in)\b/i.test(t) || /new\s+system\s+prompt/i.test(t)
  },
  {
    code: "fake-system-marker",
    reason: "content contains forged system/role delimiters",
    test: (t) => /<\/?\s*system\s*>/i.test(t) || /\[\s*(SYSTEM|INST|SYS)\s*\]/i.test(t) || /^system\s*:/im.test(t) && /assistant\s*:/i.test(t)
  },
  {
    code: "fake-tool-call",
    reason: "content embeds forged tool/function-call markup",
    test: (t) => /\[\s*tool(_use|_call|_result)?\s*\]/i.test(t) || /<\s*\/?\s*(antml|function_call|tool_use|invoke)\b/i.test(t) || /\{\s*"name"\s*:\s*"[a-z0-9_.-]{1,64}"\s*,\s*"arguments"/i.test(t)
  },
  {
    code: "encoded-payload",
    reason: "content carries a long encoded blob (base64-class) that hides instructions from review",
    test: (t) => /[A-Za-z0-9+/]{80,}={0,2}/.test(t)
  },
  {
    code: "exfiltration-prompt",
    reason: "content asks for credentials/secrets to be sent somewhere",
    test: (t) => /(api[_ -]?key|secret[_ -]?key|access[_ -]?token|password|credentials?).{0,60}(send|post|upload|fetch|transmit|exfiltrate|to\s+https?:)/i.test(t)
  },
  {
    code: "html-data-uri",
    reason: "content embeds an executable data: URI",
    test: (t) => /data\s*:\s*text\/html/i.test(t) || /javascript\s*:/i.test(t)
  },
  {
    code: "invisible-characters",
    reason: "content contains invisible/zero-width characters (smuggling surface)",
    test: (t) => INVISIBLE_UNICODE.test(t)
  }
];
function detectInjection(text) {
  if (!text) return [];
  const findings = [];
  for (const d of INJECTION_DETECTORS) {
    if (d.test(text)) findings.push({ code: d.code, reason: d.reason });
  }
  return findings;
}
var RateGate = class {
  constructor(limit, windowMs, now = () => Date.now()) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }
  hits = /* @__PURE__ */ new Map();
  /** Returns true when the action is within budget (and records it). */
  check(key) {
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(t);
    this.hits.set(key, arr);
    return true;
  }
};
var BLOCKED_HOST_SUFFIXES = [".internal", ".local", ".localhost"];
function checkEgressUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "not a parseable URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `scheme "${u.protocol}" refused \u2014 only http(s) egress is allowed` };
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    return { ok: false, reason: "cloud metadata endpoint refused (SSRF guard)" };
  }
  if (/^169\.254\./.test(host)) {
    return { ok: false, reason: "link-local address refused (SSRF guard)" };
  }
  if (host === "0.0.0.0" || host === "::") {
    return { ok: false, reason: "unspecified address refused" };
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return { ok: false, reason: "private network address refused (SSRF guard)" };
  }
  if (/^(fc|fd)[0-9a-f]{0,2}:/i.test(host) || /^fe80:/i.test(host)) {
    return { ok: false, reason: "IPv6 unique-local / link-local refused (SSRF guard)" };
  }
  for (const sfx of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(sfx)) return { ok: false, reason: `host suffix "${sfx}" refused` };
  }
  return { ok: true, reason: "" };
}
var callRateGate = new RateGate(120, 6e4);
function secureId(prefix) {
  const c = globalThis.crypto;
  const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (c && typeof c.randomUUID === "function") return `${prefix}${c.randomUUID().replace(/-/g, "")}`;
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return `${prefix}${hex(bytes)}`;
  }
  throw new Error("no secure random source available \u2014 refusing to mint an id");
}

// src/mission/a2aV10.ts
var WELL_KNOWN_CARD_PATH = "/.well-known/agent-card.json";
var A2A_ERRORS = {
  TaskNotFoundError: -32001,
  TaskNotCancelableError: -32002,
  PushNotificationNotSupportedError: -32003,
  UnsupportedOperationError: -32004,
  ContentTypeNotSupportedError: -32005,
  InvalidAgentResponseError: -32006,
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602
};
var enc = new TextEncoder();

// src/mission/a2aServer.ts
var MAX_BODY_BYTES = 1024 * 1024;
var REPLAY_WINDOW_MS = 3e4;
var AUDIT_CAP = 500;
var TASK_CAP = 200;
var STOP_HEADER = "x-si-stop-nonce";
var PAIR_PATH = "/vh/pair";
var STOP_PATH = "/vh/stop";
var ALTERSEND_PATH = "/vh/altersend";
var ALTERSEND_PREFIX = "/vh/altersend/";
var ALTERSEND_MAX_BODY = 48 * 1024 * 1024;
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}
function rpcError(res, id, code, message) {
  json(res, code <= -32e3 && code >= -32099 ? 200 : code === A2A_ERRORS.ParseError || code === A2A_ERRORS.InvalidRequest ? 400 : code === A2A_ERRORS.MethodNotFound ? 404 : 200, {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  });
}
function textOf(parts) {
  return parts.filter((p) => p.kind === "text").map((p) => p.text).join("\n");
}
function createA2AServer(opts) {
  let server = null;
  let port = 0;
  const tasks = /* @__PURE__ */ new Map();
  const history = /* @__PURE__ */ new Map();
  const pushConfigs = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Map();
  const audit = [];
  const cardJson = JSON.stringify(opts.card);
  const cardEtag = `"${createHash("sha256").update(cardJson).digest("hex").slice(0, 32)}"`;
  const note = (e) => {
    audit.push(e);
    if (audit.length > AUDIT_CAP) audit.splice(0, audit.length - AUDIT_CAP);
  };
  const evictTaskIfNeeded = () => {
    if (tasks.size <= TASK_CAP) return;
    const first = tasks.keys().next().value;
    if (first !== void 0) {
      tasks.delete(first);
      history.delete(first);
      pushConfigs.delete(first);
    }
  };
  const fingerprintOf = (req) => createHash("sha256").update(`${req.method}|${JSON.stringify(req.params ?? {})}`).digest("hex");
  const replayed = (fp) => {
    const now = Date.now();
    for (const [k, ts] of [...seen]) if (now - ts > REPLAY_WINDOW_MS) seen.delete(k);
    if (seen.has(fp)) return true;
    seen.set(fp, now);
    return false;
  };
  const pushUpdate = async (taskId, payload) => {
    const cfg = pushConfigs.get(taskId);
    if (!cfg) return;
    const guard = checkEgressUrl(cfg.url);
    if (!guard.ok) {
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pushNotification", ok: false, reason: guard.reason, taskId });
      return;
    }
    try {
      const headers = { "content-type": "application/json" };
      if (cfg.authentication?.scheme) {
        headers.authorization = `${cfg.authentication.scheme}${cfg.authentication.credentials ? ` ${cfg.authentication.credentials}` : ""}`;
      }
      const u = new URL(cfg.url);
      const mod = await import("node:http");
      await new Promise((resolve) => {
        const r = mod.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: "POST", headers, timeout: 1e4 }, (resp) => {
          resp.resume();
          resp.on("end", resolve);
        });
        r.on("error", () => resolve());
        r.on("timeout", () => {
          r.destroy();
          resolve();
        });
        r.end(JSON.stringify(payload));
      });
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pushNotification", ok: true, taskId });
    } catch {
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pushNotification", ok: false, reason: "delivery-failed", taskId });
    }
  };
  const contentRefusal = (message) => {
    const t = textOf(message.parts);
    if (t.length === 0) return null;
    const findings = detectInjection(t);
    if (findings.length > 0) return `policy:content-refused (${findings.join(", ")})`;
    return null;
  };
  const setMessage = (task, state, message) => {
    const updated = { ...task, status: { state, message, timestamp: (/* @__PURE__ */ new Date()).toISOString() } };
    tasks.set(task.id, updated);
    return updated;
  };
  const handleMessageSend = async (req, res, stream) => {
    const params = req.params ?? {};
    const msg = params.message;
    if (!msg || typeof msg !== "object" || msg.role !== "user" && msg.role !== "agent" || !Array.isArray(msg.parts)) {
      rpcError(res, req.id, A2A_ERRORS.InvalidParams, "message with role and parts is required");
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "invalid-params" });
      return;
    }
    const refused = contentRefusal(msg);
    if (refused) {
      rpcError(res, req.id, -32e3, refused);
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: refused });
      return;
    }
    let task;
    if (typeof msg.taskId === "string" && msg.taskId.length > 0) {
      const existing = tasks.get(msg.taskId);
      if (!existing) {
        rpcError(res, req.id, A2A_ERRORS.TaskNotFoundError, `no task ${msg.taskId}`);
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "task-not-found" });
        return;
      }
      if (typeof msg.contextId === "string" && msg.contextId !== existing.contextId) {
        rpcError(res, req.id, A2A_ERRORS.InvalidParams, "policy:context-mismatch \u2014 contextId does not match the referenced task");
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "context-mismatch", taskId: existing.id });
        return;
      }
      task = setMessage(existing, "working");
    } else {
      evictTaskIfNeeded();
      const id = secureId("t");
      task = {
        id,
        contextId: typeof msg.contextId === "string" && msg.contextId.length > 0 ? msg.contextId : secureId("c"),
        status: { state: "working", timestamp: (/* @__PURE__ */ new Date()).toISOString() },
        history: []
      };
      tasks.set(id, task);
      history.set(id, []);
    }
    const hist = history.get(task.id) ?? [];
    hist.push(msg);
    history.set(task.id, hist);
    const emit = (ev, isFinal) => {
      if (stream) stream.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: req.id, result: ev })}

`);
      void isFinal;
    };
    if (stream) {
      const statusEv = {
        taskId: task.id,
        contextId: task.contextId,
        final: false,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: { state: "working", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
      };
      emit({ statusUpdate: statusEv }, false);
      void pushUpdate(task.id, { statusUpdate: statusEv });
    }
    try {
      const out = await opts.onMessage(task, msg);
      const finalState = out.state ?? "completed";
      const agentMessage = {
        role: "agent",
        messageId: secureId("m"),
        parts: out.parts.map((p) => p.kind === "text" ? { ...p, text: sanitizeText(p.text, 4e3) } : p),
        taskId: task.id,
        contextId: task.contextId
      };
      let done = setMessage(task, finalState, agentMessage);
      if (out.artifacts && out.artifacts.length > 0) done = { ...done, artifacts: [...done.artifacts ?? [], ...out.artifacts] };
      tasks.set(done.id, done);
      hist.push(agentMessage);
      if (stream) {
        for (const a of out.artifacts ?? []) {
          const artEv = {
            taskId: done.id,
            contextId: done.contextId,
            artifact: a,
            lastChunk: true,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
          emit({ artifactUpdate: artEv }, false);
          void pushUpdate(done.id, { artifactUpdate: artEv });
        }
        const finalEv = {
          taskId: done.id,
          contextId: done.contextId,
          final: true,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: { state: finalState, message: agentMessage, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
        };
        emit({ statusUpdate: finalEv }, true);
        void pushUpdate(done.id, { statusUpdate: finalEv });
        stream.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: req.id, result: done })}

`);
        stream.end();
      } else {
        json(res, 200, { jsonrpc: "2.0", id: req.id, result: done });
      }
      void pushUpdate(done.id, { task: done });
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: true, taskId: done.id });
    } catch {
      const failed = setMessage(task, "failed");
      if (stream) stream.end();
      else json(res, 200, { jsonrpc: "2.0", id: req.id, result: failed });
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "handler-failed", taskId: failed.id });
    }
  };
  const handleRpc = async (req, res) => {
    switch (req.method) {
      case "message/send":
        await handleMessageSend(req, res, null);
        return;
      case "message/stream": {
        if (opts.card.capabilities.streaming !== true) {
          rpcError(res, req.id, A2A_ERRORS.UnsupportedOperationError, "this agent does not declare capabilities.streaming");
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "unsupported" });
          return;
        }
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        await handleMessageSend(req, res, res);
        return;
      }
      case "tasks/get": {
        const p = req.params ?? {};
        const id = p.id ?? p.name;
        const t = typeof id === "string" ? tasks.get(id) : void 0;
        if (!t) {
          rpcError(res, req.id, A2A_ERRORS.TaskNotFoundError, "task not found");
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "task-not-found" });
          return;
        }
        const h = history.get(t.id) ?? [];
        const slice = typeof p.historyLength === "number" && p.historyLength >= 0 ? h.slice(-p.historyLength) : h;
        json(res, 200, { jsonrpc: "2.0", id: req.id, result: { ...t, history: slice } });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: true, taskId: t.id });
        return;
      }
      case "tasks/cancel": {
        const p = req.params ?? {};
        const id = p.id ?? p.name;
        const t = typeof id === "string" ? tasks.get(id) : void 0;
        if (!t) {
          rpcError(res, req.id, A2A_ERRORS.TaskNotFoundError, "task not found");
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "task-not-found" });
          return;
        }
        if (["completed", "failed", "canceled", "rejected"].includes(t.status.state)) {
          rpcError(res, req.id, A2A_ERRORS.TaskNotCancelableError, `task already terminal (${t.status.state})`);
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "not-cancelable", taskId: t.id });
          return;
        }
        const canceled = setMessage(t, "canceled");
        json(res, 200, { jsonrpc: "2.0", id: req.id, result: canceled });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: true, taskId: canceled.id });
        return;
      }
      case "tasks/pushNotificationConfig/set": {
        if (opts.card.capabilities.pushNotifications !== true) {
          rpcError(res, req.id, A2A_ERRORS.PushNotificationNotSupportedError, "this agent does not declare capabilities.pushNotifications");
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "unsupported" });
          return;
        }
        const p = req.params ?? {};
        if (typeof p.taskId !== "string" || !tasks.has(p.taskId) || !p.pushNotificationConfig || typeof p.pushNotificationConfig.url !== "string") {
          rpcError(res, req.id, A2A_ERRORS.InvalidParams, "taskId (existing) and pushNotificationConfig.url are required");
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "invalid-params" });
          return;
        }
        const guard = checkEgressUrl(p.pushNotificationConfig.url);
        if (!guard.ok) {
          rpcError(res, req.id, -32e3, `policy:egress-refused \u2014 ${guard.reason}`);
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: guard.reason, taskId: p.taskId });
          return;
        }
        pushConfigs.set(p.taskId, p.pushNotificationConfig);
        json(res, 200, { jsonrpc: "2.0", id: req.id, result: { taskId: p.taskId, pushNotificationConfig: p.pushNotificationConfig } });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: true, taskId: p.taskId });
        return;
      }
      case "tasks/pushNotificationConfig/get": {
        const p = req.params ?? {};
        const cfg = typeof p.taskId === "string" ? pushConfigs.get(p.taskId) : void 0;
        if (!cfg) {
          rpcError(res, req.id, A2A_ERRORS.TaskNotFoundError, "no push config for that task");
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "no-config" });
          return;
        }
        json(res, 200, { jsonrpc: "2.0", id: req.id, result: { taskId: p.taskId, pushNotificationConfig: cfg } });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: true, taskId: p.taskId ?? "" });
        return;
      }
      default:
        rpcError(res, req.id, A2A_ERRORS.MethodNotFound, `method not found: ${req.method}`);
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: req.method, ok: false, reason: "method-not-found" });
    }
  };
  const handle = (req, res) => {
    if (req.method === "GET" && req.url === WELL_KNOWN_CARD_PATH) {
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
        etag: cardEtag
      });
      res.end(cardJson);
      return;
    }
    if (req.method === "POST" && req.url === STOP_PATH) {
      if (!opts.onStop) {
        json(res, 404, { error: "no-unmount", reason: "this host was not started with an unmount channel" });
        return;
      }
      const presented = String(req.headers[STOP_HEADER] ?? "");
      const accepted = opts.onStop(presented);
      if (!accepted) {
        json(res, 403, { error: "unmount-refused", reason: "the unmount nonce did not match" });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "unmount", ok: false, reason: "nonce" });
        return;
      }
      json(res, 200, { ok: true, detail: "the host is stopping" });
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "unmount", ok: true, reason: "accepted" });
      return;
    }
    if (req.method === "POST" && req.url === PAIR_PATH) {
      if (!opts.pairing) {
        json(res, 404, { error: "not-pairing", reason: "this host is not accepting pairings" });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pair", ok: false, reason: "not-pairing" });
        return;
      }
      const chunks2 = [];
      let size2 = 0;
      req.on("data", (c) => {
        size2 += c.byteLength;
        if (size2 > MAX_BODY_BYTES) {
          req.destroy();
          return;
        }
        chunks2.push(c);
      });
      req.on("end", () => {
        if (size2 > MAX_BODY_BYTES) return;
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks2).toString("utf8"));
        } catch {
          json(res, 400, { error: "invalid-json", reason: "the pairing request was not valid JSON" });
          return;
        }
        const code = typeof body.code === "string" ? body.code : "";
        const fp = typeof body.peer?.fp === "string" ? body.peer.fp : "";
        const name = typeof body.peer?.name === "string" ? body.peer.name.slice(0, 80) : "a peer";
        if (code === "" || fp === "") {
          json(res, 400, { error: "bad-request", reason: "a pairing request needs a code and the peer's identity fingerprint" });
          return;
        }
        void opts.pairing.redeem(code, { fp, name }).then((r) => {
          if (r.ok) {
            json(res, 200, { ok: true, credential: r.credential });
            note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pair", ok: true, reason: "redeemed" });
          } else {
            json(res, 403, { ok: false, error: "pairing-refused", reason: r.reason });
            note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pair", ok: false, reason: r.reason });
          }
        }).catch((e) => {
          json(res, 500, { ok: false, error: "pairing-failed", reason: String(e) });
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "pair", ok: false, reason: "threw" });
        });
      });
      return;
    }
    if (req.url === ALTERSEND_PATH || req.url?.startsWith(ALTERSEND_PREFIX)) {
      if (!opts.altersend) {
        json(res, 404, { error: "not-enabled", reason: "this host has file sharing turned off" });
        return;
      }
      if (!opts.authorize || !opts.authorize(req)) {
        json(res, 401, { error: "unauthorized", reason: "a paired credential is required to move files" });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "altersend", ok: false, reason: "unauthorized" });
        return;
      }
      const store = opts.altersend.store;
      const id = req.url.startsWith(ALTERSEND_PREFIX) ? req.url.slice(ALTERSEND_PREFIX.length) : "";
      if (req.method === "GET" && !id) {
        json(res, 200, { ok: true, offers: store.list() });
        return;
      }
      if (req.method === "GET" && id) {
        const got = store.get(id);
        if (!got.ok) {
          json(res, 404, { error: got.reason });
          return;
        }
        const pulled = store.fetch(id);
        if (!pulled.ok) {
          json(res, 409, { error: pulled.reason });
          return;
        }
        json(res, 200, {
          ok: true,
          offer: pulled.value.offer,
          bytes: pulled.value.bytes.toString("base64")
        });
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "altersend-fetch", ok: true, reason: id });
        return;
      }
      if (req.method === "POST" && id) {
        let decision = "accept";
        const chunks2 = [];
        req.on("data", (c) => chunks2.push(c));
        req.on("end", () => {
          try {
            const b = JSON.parse(Buffer.concat(chunks2).toString("utf8") || "{}");
            decision = b.decision === "refuse" ? "refuse" : "accept";
          } catch {
            decision = "accept";
          }
          const out = decision === "refuse" ? store.refuse(id, "the receiver declined") : store.accept(id);
          if (!out.ok) {
            json(res, 409, { error: out.reason });
            return;
          }
          json(res, 200, { ok: true, offer: out.value });
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "altersend-decide", ok: true, reason: `${decision}:${id}` });
        });
        return;
      }
      if (req.method === "POST" && !id) {
        const chunks2 = [];
        let size2 = 0;
        req.on("data", (c) => {
          size2 += c.byteLength;
          if (size2 > ALTERSEND_MAX_BODY) {
            req.destroy();
            return;
          }
          chunks2.push(c);
        });
        req.on("end", () => {
          if (size2 > ALTERSEND_MAX_BODY) {
            json(res, 413, { error: "too-large" });
            return;
          }
          let body;
          try {
            body = JSON.parse(Buffer.concat(chunks2).toString("utf8"));
          } catch {
            json(res, 400, { error: "bad-json" });
            return;
          }
          let bytes;
          try {
            bytes = Buffer.from(String(body.data ?? ""), "base64");
          } catch {
            json(res, 400, { error: "bad-base64" });
            return;
          }
          const offered = store.offer({ name: String(body.name ?? ""), bytes });
          if (!offered.ok) {
            json(res, 400, { error: offered.reason });
            return;
          }
          const refusal = opts.altersend?.decide?.(offered.value);
          if (refusal) {
            store.refuse(offered.value.id, refusal);
            json(res, 403, { error: "refused", reason: refusal, offer: offered.value });
            note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "altersend-offer", ok: false, reason: refusal });
            return;
          }
          store.accept(offered.value.id);
          json(res, 201, { ok: true, offer: offered.value });
          note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "altersend-offer", ok: true, reason: offered.value.id });
        });
        return;
      }
      json(res, 405, { error: "method-not-allowed" });
      return;
    }
    if (req.method !== "POST" || req.url !== "/" && req.url !== "") {
      json(res, 404, { error: "not-found" });
      return;
    }
    if ((req.headers["content-type"] ?? "").split(";")[0].trim() !== "application/json") {
      rpcError(res, null, A2A_ERRORS.InvalidRequest, "content-type must be application/json");
      note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "(post)", ok: false, reason: "content-type" });
      return;
    }
    if (opts.card.securitySchemes && Object.keys(opts.card.securitySchemes).length > 0) {
      if (!opts.authorize || !opts.authorize(req)) {
        rpcError(res, null, A2A_ERRORS.InvalidRequest, "policy:unauthorized \u2014 declared securitySchemes not satisfied");
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "(post)", ok: false, reason: "unauthorized" });
        return;
      }
    }
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) return;
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        rpcError(res, null, A2A_ERRORS.ParseError, "invalid JSON");
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "(post)", ok: false, reason: "parse-error" });
        return;
      }
      const rpc = parsed;
      if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string" || (rpc.id === void 0 || rpc.id === null)) {
        rpcError(res, rpc.id ?? null, A2A_ERRORS.InvalidRequest, "jsonrpc 2.0 request with id is required");
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: "(post)", ok: false, reason: "invalid-request" });
        return;
      }
      const fp = fingerprintOf(rpc);
      if (replayed(fp)) {
        rpcError(res, rpc.id, -32e3, "policy:replayed-request \u2014 identical request already processed within the replay window");
        note({ ts: (/* @__PURE__ */ new Date()).toISOString(), method: rpc.method, ok: false, reason: "replayed" });
        return;
      }
      void handleRpc(rpc, res);
    });
  };
  return {
    async start() {
      server = createServer(handle);
      await new Promise((resolve, reject) => {
        server?.once("error", reject);
        server?.listen(opts.port ?? 0, opts.host ?? "127.0.0.1", () => resolve());
      });
      const addr = server?.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      return port;
    },
    async stop() {
      await new Promise((resolve) => {
        server?.close(() => resolve());
      });
      server = null;
    },
    get port() {
      return port;
    },
    get baseUrl() {
      return `http://${opts.host ?? "127.0.0.1"}:${port}`;
    },
    get audit() {
      return audit;
    },
    get tasks() {
      return tasks;
    }
  };
}

// src/mission/altersend.ts
import { createHash as createHash2, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
var DEFAULT_LIMITS = {
  maxFileBytes: 32 * 1024 * 1024,
  maxStoreBytes: 256 * 1024 * 1024,
  maxFiles: 64,
  maxNameLength: 120,
  ttlMs: 60 * 60 * 1e3
};
function contentId(digest) {
  return digest.replace("sha256:", "").slice(0, 24);
}
function digestOf(bytes) {
  return `sha256:${createHash2("sha256").update(bytes).digest("hex")}`;
}
function safeName(raw, maxLength = DEFAULT_LIMITS.maxNameLength) {
  if (typeof raw !== "string" || raw.length === 0) return { ok: false, reason: "name:empty" };
  const cleaned = raw.replace(/[\x00-\x1f\x7f]/g, "").replace(/[/\\]/g, "-").replace(/\.{2,}/g, ".").replace(/^[.\-\s]+/, "").replace(/[^\w .()\-]+/g, "").trim();
  if (cleaned.length === 0) return { ok: false, reason: "name:empty-after-sanitising" };
  return { ok: true, value: cleaned.slice(0, maxLength) };
}
var AlterSendStore = class {
  entries = /* @__PURE__ */ new Map();
  receipts = [];
  limits;
  peer;
  now;
  root;
  /** How many bytes may be resident at once. Older objects fall back to disk. */
  residentBytes;
  resident = 0;
  constructor(opts) {
    this.limits = { ...DEFAULT_LIMITS, ...opts.limits ?? {} };
    this.peer = opts.peer;
    this.now = opts.now ?? (() => /* @__PURE__ */ new Date());
    this.residentBytes = Math.min(this.limits.maxFileBytes, 8 * 1024 * 1024);
    if (opts.spillDir) {
      fs.mkdirSync(opts.spillDir, { recursive: true, mode: 448 });
      fs.chmodSync(opts.spillDir, 448);
      this.root = opts.spillDir;
    } else {
      this.root = null;
    }
  }
  /** Remove every spilled object and the directory. Call on unmount. */
  close() {
    for (const [id] of this.entries) {
      const e = this.entries.get(id);
      if (e?.objectPath) {
        try {
          fs.rmSync(e.objectPath, { force: true });
        } catch {
        }
      }
    }
    this.entries.clear();
    this.resident = 0;
    if (this.root) {
      try {
        fs.rmSync(this.root, { recursive: true, force: true });
      } catch {
      }
    }
  }
  objectPathFor(digest) {
    return this.root ? path.join(this.root, digest.replace(":", "-")) : null;
  }
  /** Write bytes atomically and 0600: a reader never sees a half-written file. */
  writeObject(digest, bytes) {
    const p = this.objectPathFor(digest);
    if (!p) return null;
    const tmp = `${p}.${process.pid}.partial`;
    const fd = fs.openSync(tmp, "wx", 384);
    try {
      fs.writeSync(fd, bytes);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, p);
    return p;
  }
  readObject(entry) {
    if (entry.bytes) return entry.bytes;
    if (!entry.objectPath) throw new Error("altersend: object is not on disk");
    const bytes = fs.readFileSync(entry.objectPath);
    if (digestOf(bytes) !== entry.offer.digest) throw new Error("altersend: object failed its digest on read");
    return bytes;
  }
  /**
   * Keep the resident window bounded. Anything evicted stays on disk and is
   * re-read (and re-verified) on demand, so eviction costs a read, not
   * correctness.
   */
  evictFor(incoming) {
    for (const [, e] of this.entries) {
      if (this.resident + incoming <= this.residentBytes) break;
      if (e.bytes && e.objectPath) {
        this.resident -= e.bytes.byteLength;
        e.bytes = null;
      }
    }
  }
  record(id, decision, detail) {
    const at = this.now().toISOString();
    const prev = this.receipts[this.receipts.length - 1]?.digest ?? "";
    const payload = `${prev}|${id}|${decision}|${detail}|${at}`;
    const receipt = {
      id,
      at,
      decision,
      detail,
      digest: `sha256:${createHash2("sha256").update(payload).digest("hex")}`
    };
    this.receipts.push(receipt);
    return receipt;
  }
  /** Bytes held by the store, resident or spilled — this is what the quota counts. */
  get storeBytes() {
    let n = 0;
    for (const e of this.entries.values()) n += e.offer.size;
    return n;
  }
  /** Bytes actually in the JS heap. Bounded by the resident window, not the quota. */
  get residentBytesHeld() {
    return this.resident;
  }
  /** Objects currently on disk, for the operator-facing store report. */
  get spilledCount() {
    let n = 0;
    for (const e of this.entries.values()) if (e.objectPath) n += 1;
    return n;
  }
  /**
   * Publish a file. Rejects rather than evicts: silently dropping the oldest
   * entry to make room would mean the sender's offer had been honoured and then
   * un-honoured, and the receipt would be lying.
   */
  offer(file) {
    const name = safeName(file.name, this.limits.maxNameLength);
    if (!name.ok) {
      this.record(":", "refused", name.reason);
      return name;
    }
    if (!Buffer.isBuffer(file.bytes) || file.bytes.byteLength === 0) {
      this.record(":", "refused", "empty");
      return { ok: false, reason: "file:empty" };
    }
    if (file.bytes.byteLength > this.limits.maxFileBytes) {
      this.record(":", "refused", "too-large");
      return { ok: false, reason: `file:too-large (max ${this.limits.maxFileBytes})` };
    }
    if (this.entries.size >= this.limits.maxFiles) {
      this.record(":", "refused", "store-full");
      return { ok: false, reason: "store:full" };
    }
    if (this.storeBytes + file.bytes.byteLength > this.limits.maxStoreBytes) {
      this.record(":", "refused", "store-bytes");
      return { ok: false, reason: "store:full" };
    }
    const digest = digestOf(file.bytes);
    const id = contentId(digest);
    if (this.entries.has(id)) return { ok: false, reason: "file:already-offered" };
    const offer = {
      id,
      name: name.value,
      size: file.bytes.byteLength,
      digest,
      offeredAt: this.now().toISOString(),
      from: this.peer
    };
    const objectPath = this.writeObject(digest, file.bytes);
    let resident = file.bytes;
    if (objectPath) {
      this.evictFor(file.bytes.byteLength);
      if (file.bytes.byteLength > this.residentBytes) resident = null;
      else this.resident += file.bytes.byteLength;
    }
    this.entries.set(id, { offer, bytes: resident, objectPath, decision: "pending", detail: "" });
    this.record(id, "pending", `${offer.name} (${offer.size} bytes)`);
    return { ok: true, value: offer };
  }
  list() {
    return [...this.entries.values()].map((e) => e.offer);
  }
  get(id) {
    const e = this.entries.get(id);
    return e ? { ok: true, value: e.offer } : { ok: false, reason: "no-such-offer" };
  }
  /**
   * The receiver's decision. This is the only way a file becomes accepted, and
   * it verifies the bytes against the hash the sender published first — a sender
   * that lies about the digest is caught here, not at write time.
   */
  accept(id) {
    const e = this.entries.get(id);
    if (!e) return { ok: false, reason: "no-such-offer" };
    if (e.decision !== "pending") return { ok: false, reason: `already:${e.decision}` };
    let current;
    try {
      current = this.readObject(e);
    } catch (err) {
      e.decision = "refused";
      e.detail = "unreadable";
      this.record(id, "refused", err instanceof Error ? err.message : "the object could not be read back");
      return { ok: false, reason: "file:unreadable" };
    }
    if (digestOf(current) !== e.offer.digest) {
      e.decision = "refused";
      e.detail = "digest-mismatch";
      this.record(id, "refused", "the bytes do not match the digest the sender published");
      return { ok: false, reason: "file:digest-mismatch" };
    }
    e.decision = "accepted";
    this.record(id, "accepted", e.offer.name);
    return { ok: true, value: e.offer };
  }
  refuse(id, why = "the receiver declined") {
    const e = this.entries.get(id);
    if (!e) return { ok: false, reason: "no-such-offer" };
    if (e.decision !== "pending") return { ok: false, reason: `already:${e.decision}` };
    e.decision = "refused";
    e.detail = why;
    this.record(id, "refused", why);
    return { ok: true, value: e.offer };
  }
  /** Hand over the bytes — only ever after accept(). */
  fetch(id) {
    const e = this.entries.get(id);
    if (!e) return { ok: false, reason: "no-such-offer" };
    if (e.decision !== "accepted") return { ok: false, reason: `not-accepted (${e.decision})` };
    let bytes;
    try {
      bytes = this.readObject(e);
    } catch (err) {
      e.decision = "refused";
      e.detail = "unreadable";
      this.record(id, "refused", err instanceof Error ? err.message : "the object could not be read back");
      return { ok: false, reason: "file:unreadable" };
    }
    e.decision = "fetched";
    if (e.bytes) {
      this.resident -= e.bytes.byteLength;
      e.bytes = null;
    }
    this.record(id, "fetched", e.offer.name);
    return { ok: true, value: { offer: e.offer, bytes: Buffer.from(bytes) } };
  }
  drop(id) {
    const e = this.entries.get(id);
    if (!e) return { ok: false, reason: "no-such-offer" };
    if (e.objectPath) {
      try {
        fs.rmSync(e.objectPath, { force: true });
      } catch {
      }
    }
    if (e.bytes) this.resident -= e.bytes.byteLength;
    this.entries.delete(id);
    this.record(id, "refused", "dropped");
    return { ok: true, value: true };
  }
  /** The ledger, for the receipts screen. */
  ledger() {
    return [...this.receipts];
  }
  /**
   * Re-walk the chain. Any entry removed or edited from the middle breaks every
   * later digest — the same property the crash ledger buys, for the same reason.
   */
  verifyChain() {
    let prev = "";
    for (let i = 0; i < this.receipts.length; i += 1) {
      const r = this.receipts[i];
      const payload = `${prev}|${r.id}|${r.decision}|${r.detail}|${r.at}`;
      const want = `sha256:${createHash2("sha256").update(payload).digest("hex")}`;
      if (want.length !== r.digest.length || !timingSafeEqual(Buffer.from(want), Buffer.from(r.digest))) {
        return { ok: false, brokenAt: i };
      }
      prev = r.digest;
    }
    return { ok: true };
  }
};

// src/mission/a2aClient.ts
async function sendFileToPeer(opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 3e4);
  try {
    const res = await fetch(`${opts.baseUrl.replace(/\/+$/, "")}/vh/altersend`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.token}` },
      body: JSON.stringify({ name: opts.name, data: opts.bytes.toString("base64") }),
      signal: ctl.signal
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, reason: String(body.reason ?? body.error ?? res.status) };
    return { ok: true, offer: body.offer };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
async function fetchFileFromPeer(opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 3e4);
  try {
    const res = await fetch(`${opts.baseUrl.replace(/\/+$/, "")}/vh/altersend/${encodeURIComponent(opts.id)}`, {
      headers: { authorization: `Bearer ${opts.token}` },
      signal: ctl.signal
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, reason: String(body.reason ?? body.error ?? res.status) };
    const offer = body.offer;
    return { ok: true, name: offer.name, bytes: Buffer.from(String(body.bytes ?? ""), "base64"), digest: offer.digest };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// probe/altersend.test.ts
var pass = 0;
var failures = [];
var ok = (cond, msg, detail = "") => {
  if (cond) {
    pass += 1;
    return;
  }
  failures.push(`${msg}${detail ? ` \u2014 ${detail}` : ""}`);
};
var section = (t) => {
  console.log(`
== ${t} ==`);
};
var CARD = {
  protocolVersion: "1.0",
  name: "alter-send-probe",
  description: "a host that accepts files",
  version: "1.0.0",
  url: "http://127.0.0.1:0/",
  capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [],
  securitySchemes: { bearer: { type: "http", scheme: "bearer" } }
};
var goodToken = "peer-token-good";
var badToken = "peer-token-bad";
section("1 \xB7 a name can never become a path");
{
  const attacks = [
    "../../.ssh/authorized_keys",
    "/etc/passwd",
    "..\\..\\windows\\system32\\cmd.exe",
    "....//....//etc/shadow",
    "  .ssh/authorized_keys  ",
    "\0\0evil.txt",
    "a/b/c/d.txt"
  ];
  for (const a of attacks) {
    const r = safeName(a);
    const clean = r.ok ? r.value : "";
    ok(
      !clean.includes("/") && !clean.includes("\\") && !clean.includes(".."),
      `"${a}" cannot produce a path`,
      `got "${clean}"`
    );
    ok(!clean.startsWith("."), `"${a}" cannot produce a dotfile`, `got "${clean}"`);
  }
  ok(safeName("").ok === false, "an empty name is refused");
  ok(safeName("   ").ok === false, "a whitespace name is refused");
  ok(safeName("\0").ok === false, "a null-byte name is refused");
  const long = safeName("x".repeat(500));
  ok(long.ok && long.value.length <= 120, "a very long name is truncated, not refused");
  ok(safeName("quarterly report (final).pdf").ok, "an ordinary name survives intact");
}
section("2 \xB7 the store refuses rather than evicts");
{
  const store = new AlterSendStore({ peer: "peer-a", limits: { maxFileBytes: 64, maxStoreBytes: 200, maxFiles: 3 } });
  ok(store.offer({ name: "a.txt", bytes: Buffer.from("a".repeat(10)) }).ok, "a small file is accepted");
  ok(!store.offer({ name: "big.txt", bytes: Buffer.from("b".repeat(65)) }).ok, "a file over the size cap is refused");
  ok(store.offer({ name: "a.txt", bytes: Buffer.from("a".repeat(10)) }).ok === false, "the same content offered twice is refused");
  store.offer({ name: "c.txt", bytes: Buffer.from("c".repeat(10)) });
  ok(store.offer({ name: "d.txt", bytes: Buffer.from("d".repeat(10)) }).ok, "up to maxFiles is fine");
  ok(!store.offer({ name: "e.txt", bytes: Buffer.from("e".repeat(10)) }).ok, "the file-count cap is enforced");
  ok(store.list().length === 3, "a refused offer leaves nothing behind");
  const byBytes = new AlterSendStore({ peer: "p", limits: { maxFileBytes: 100, maxStoreBytes: 150 } });
  byBytes.offer({ name: "1.bin", bytes: Buffer.alloc(100) });
  ok(!byBytes.offer({ name: "2.bin", bytes: Buffer.alloc(100) }).ok, "the store-byte cap is enforced");
  const empty = new AlterSendStore({ peer: "p" });
  ok(!empty.offer({ name: "nothing", bytes: Buffer.alloc(0) }).ok, "an empty file is refused");
  ok(!empty.offer({ name: "", bytes: Buffer.from("x") }).ok, "a nameless file is refused");
}
section("3 \xB7 bytes only move after the receiver accepts");
{
  const store = new AlterSendStore({ peer: "peer-b" });
  const offer = store.offer({ name: "report.pdf", bytes: Buffer.from("the real contents") });
  ok(offer.ok, "the file is offered");
  if (offer.ok) {
    const id = offer.value.id;
    ok(store.fetch(id).ok === false, "fetching BEFORE acceptance is refused");
    ok(store.accept(id).ok, "the receiver accepts");
    ok(store.accept(id).ok === false, "accepting twice is refused");
    const pulled = store.fetch(id);
    ok(pulled.ok, "after acceptance the bytes are handed over");
    if (pulled.ok) {
      ok(pulled.value.bytes.toString() === "the real contents", "the bytes arrive intact");
      ok(pulled.value.offer.digest === digestOf(pulled.value.bytes), "the digest matches the bytes");
    }
    ok(store.fetch(id).ok === false, "a second fetch is refused \u2014 one transfer, one fetch");
  }
  const refused = new AlterSendStore({ peer: "p" });
  const o2 = refused.offer({ name: "secret.env", bytes: Buffer.from("TOKEN=abc") });
  if (o2.ok) {
    ok(refused.accept(o2.value.id).ok, "an offer can be accepted");
    ok(refused.get(o2.value.id).ok, "the offer is still listed");
  }
  const declined = new AlterSendStore({ peer: "p" });
  const o3 = declined.offer({ name: "big.bin", bytes: Buffer.from("x") });
  if (o3.ok) {
    ok(declined.refuse(o3.value.id, "too big for my taste").ok, "the receiver may refuse");
    ok(declined.fetch(o3.value.id).ok === false, "a refused file never yields bytes");
  }
}
section("4 \xB7 the receiver verifies what it was promised");
{
  const store = new AlterSendStore({ peer: "p" });
  const real = Buffer.from("honest contents");
  const offer = store.offer({ name: "x.txt", bytes: real });
  ok(offer.ok, "an honest offer is made");
  const entry = store.entries.get(
    offer.ok ? offer.value.id : ""
  );
  if (entry) {
    entry.bytes = Buffer.from("swapped contents");
    const verdict = store.accept(offer.ok ? offer.value.id : "");
    ok(verdict.ok === false, "a swapped payload fails acceptance");
    ok(String(verdict.ok === false && verdict.reason).includes("digest"), "and says why \u2014 a digest mismatch");
    ok(store.fetch(offer.ok ? offer.value.id : "").ok === false, "the lied-about file never yields bytes");
  }
}
section("5 \xB7 the receipt ledger");
{
  const store = new AlterSendStore({ peer: "peer-c" });
  const a = store.offer({ name: "a.txt", bytes: Buffer.from("one") });
  if (a.ok) store.accept(a.value.id), store.fetch(a.value.id);
  store.offer({ name: "b.txt", bytes: Buffer.from("two") });
  const ledger = store.ledger();
  ok(ledger.length >= 3, "offer, accept and fetch each leave an entry", `${ledger.length}`);
  ok(ledger.every((r) => /^sha256:[0-9a-f]{64}$/.test(r.digest)), "every receipt is digest-stamped");
  ok(store.verifyChain().ok, "the chain verifies");
  const tampered = store.ledger()[1];
  const before = tampered.detail;
  tampered.detail = "edited after the fact";
  ok(!store.verifyChain().ok, "editing an entry in the middle breaks the chain");
  tampered.detail = before;
  ok(store.verifyChain().ok, "restoring it verifies again");
  const chain = store.receipts;
  chain.splice(1, 1);
  ok(!store.verifyChain().ok, "removing an entry breaks every later digest too");
}
section("6 \xB7 the HTTP surface");
{
  const store = new AlterSendStore({ peer: "self" });
  const handle = createA2AServer({
    card: { ...CARD, url: "http://127.0.0.1/" },
    onMessage: async () => ({ kind: "task", task: {} }),
    authorize: (req) => req.headers.authorization === `Bearer ${goodToken}`,
    altersend: { store }
  });
  await handle.start(0);
  const base = `http://127.0.0.1:${handle.port}`;
  const unauth = await fetch(`${base}/vh/altersend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "stolen.txt", data: Buffer.from("nope").toString("base64") })
  });
  ok(unauth.status === 401, "an unauthenticated offer is refused", `got ${unauth.status}`);
  ok(store.list().length === 0, "and nothing landed");
  const wrongTok = await fetch(`${base}/vh/altersend`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${badToken}` },
    body: JSON.stringify({ name: "stolen.txt", data: Buffer.from("nope").toString("base64") })
  });
  ok(wrongTok.status === 401, "a wrong credential is refused", `got ${wrongTok.status}`);
  const sent = await sendFileToPeer({
    baseUrl: base,
    token: goodToken,
    name: "design notes.md",
    bytes: Buffer.from("# notes\n\nthe actual content\n")
  });
  ok(sent.ok, "an authenticated offer is accepted", sent.ok ? "" : sent.reason);
  if (sent.ok) {
    ok(sent.offer.name === "design notes.md", "the name arrives");
    const expected = Buffer.byteLength("# notes\n\nthe actual content\n");
    ok(sent.offer.size === expected, "the size is reported honestly", `${sent.offer.size} vs ${expected}`);
    ok(sent.offer.digest === digestOf(Buffer.from("# notes\n\nthe actual content\n")), "the digest matches the sent bytes");
    const got = await fetchFileFromPeer({ baseUrl: base, token: goodToken, id: sent.offer.id });
    ok(got.ok, "the receiver fetches it", got.ok ? "" : got.reason);
    if (got.ok) {
      ok(got.bytes.toString() === "# notes\n\nthe actual content\n", "the bytes survive the round trip");
      ok(got.name === "design notes.md", "the name survives the round trip");
    }
    const replay = await fetchFileFromPeer({ baseUrl: base, token: goodToken, id: sent.offer.id });
    ok(replay.ok === false, "the same id cannot be fetched twice");
  }
  const evil = await sendFileToPeer({
    baseUrl: base,
    token: goodToken,
    name: "../../.ssh/authorized_keys",
    bytes: Buffer.from("ssh-rsa AAAA")
  });
  if (evil.ok) {
    ok(!evil.offer.name.includes("/") && !evil.offer.name.includes(".."), "a traversal name is flattened on arrival");
  } else {
    ok(true, "a traversal name is refused outright");
  }
  const listNoAuth = await fetch(`${base}/vh/altersend`);
  ok(listNoAuth.status === 401, "listing requires a credential as well", `got ${listNoAuth.status}`);
  const list = await fetch(`${base}/vh/altersend`, { headers: { authorization: `Bearer ${goodToken}` } });
  ok(list.ok, "listing works with one");
  const listed = await list.json();
  ok(Array.isArray(listed.offers) && listed.offers.length > 0, "the offers are listed");
  const bare = createA2AServer({
    card: CARD,
    onMessage: async () => ({ kind: "task", task: {} }),
    authorize: () => true
  });
  await bare.start(0);
  const bareRes = await fetch(`http://127.0.0.1:${bare.port}/vh/altersend`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${goodToken}` },
    body: JSON.stringify({ name: "x", data: "" })
  });
  ok(bareRes.status === 404, "a host that never enabled sharing returns 404, not a refusal", `got ${bareRes.status}`);
  await bare.stop();
  await handle.stop();
}
console.log(`
${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
if (failures.length) process.exit(1);
