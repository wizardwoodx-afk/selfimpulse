/**
 * SelfImpulse — one shell, seven doors.
 * Captain · Work · Specialists · Receipts · Docs · Memory · Settings.
 *
 * The crew is internal: AGENT 01..N always run natively on the owner's
 * provider keys and never face the user by name. Installed coding CLIs
 * (Claude Code, Codex, ACP agents, user-registered custom binaries, ...)
 * are invoked only as bounded sub-task harnesses inside a mission with a
 * real workspace root and the codingAgents boundary flag set — they are
 * tools, not crew, and every invocation is shown before execution and
 * receipted. What the user sees is the work flowing and its receipts.
 * Engine: MJ.
 */
import React from "react";
import { Shell } from "./ui/Shell";

export const VouchApp: React.FC = () => <Shell />;
export default VouchApp;
