---
name: make-bot-ui
description: Build a local web UI whose controls send authenticated JSON to an existing agent or automation webhook, with server-side secret handling and optional tailnet access.
---

# Make bot UI

Build a page the user clicks. A local server sends JSON to an agent or automation webhook. Keep credentials on the server. Never place them in browser code, chat, logs, or command arguments.

Read `../pstack-harness/SKILL.md` before discovering automation and secret-input capabilities.

## Establish the webhook

Use an existing webhook when the user provides one. If the current harness or connected automation service can create webhook-triggered routines, create the narrowest routine that matches the requested action. Treat the POST body as untrusted data and name the accepted JSON fields in the routine prompt.

Creating an external routine changes account state. Identify the account, target, and scope, then obtain any approval the active harness requires. If no webhook automation capability exists, stop and ask for an existing endpoint rather than inventing one.

## Receive credentials

Use the harness's protected secret-input mechanism or the command's documented credential flow. The user may share a non-secret webhook URL in chat. They must not paste a sender key, bearer token, or cookie into chat.

Store the endpoint and credential in the UI server's private configuration using restrictive filesystem permissions or the platform's credential store. Do not print the credential during setup or verification.

## Build the local server

The browser sends actions only to the local server. The local server validates the action against a fixed allowlist, builds the small JSON payload named in the routine prompt, and sends it to the webhook with an eight-second timeout and no automatic retry. A retry can duplicate an external action.

Bind to `127.0.0.1` by default. Bind to the tailnet interface or `0.0.0.0` only when the user asks for remote access and the route is protected. Never expose the credential to the browser.

Record failed payloads only when retry is safe and useful. Redact secrets and personal data. Do not queue media bytes in a JSON retry log.

## Verify

Probe the local page and one harmless action the routine ignores or treats as a dry run. Confirm the local server returns a clear success or failure and the remote endpoint acknowledges the request. Do not trigger a real side effect merely to test wiring.

## Optional tailnet access

Reuse an existing online Tailscale node when available. Report its DNS name and tailnet IP with the selected port. Use HTTP inside the encrypted tailnet unless the user asks for application-layer HTTPS.

Installing Tailscale, joining a tailnet, or changing node settings requires the user's approval. Let the user complete browser login or identity verification, then confirm reachability from the tailnet address.
