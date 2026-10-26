# StripBot Cloud MCP: Render connection

## Deployed endpoint

- Render service: `stripbot-mcp-v2`
- MCP URL: `https://stripbot-mcp-v2.onrender.com/mcp`
- Health URL: `https://stripbot-mcp-v2.onrender.com/health`
- Auth: HTTP `Authorization: Bearer <MCP_ACCESS_TOKEN>`

The Render environment variable `MCP_ACCESS_TOKEN` must contain a secret of at least 24 characters. Never paste the secret into GitHub, the marketplace catalog, a screenshot, a URL, or a chat message.

## Connect from StripBot

1. Update StripBot to a desktop build containing the new **MCP Connection → StripBot Cloud** panel.
2. In your own Render dashboard, find the secret `MCP_ACCESS_TOKEN` under Environment. If it cannot be retrieved, rotate the secret and redeploy.
3. Paste it in the password field in **StripBot Cloud → Connect**. The backend stores it in process memory only and never writes it into `.runtime/integrations.json`.
4. In the newly created **StripBot Cloud（Render）** service card, click **测试远程握手**. Allow a cold start delay of up to ~90 seconds for the free-tier service.
5. Switch to **功能与数据**, select `service_status` and click **查询云端状态**. The result should contain `ok: true`.
6. On restart, re-enter the Token; by design, the credential is not persisted.

Read-only service-call permission is granted only to the exact `service_status` tool. Remote tool calls do not automatically grant the Codex executor any MCP permissions. The local gateway is bound to `127.0.0.1`, and remote URL routing is pinned to the known Render HTTPS endpoint to reduce SSRF risk. No redirects are followed.

### What runs in the cloud

The deployed Render MCP service is a **read-only example**, exposing `service_status`. It does not yet host an archive converter, an office converter, or desktop pets.

Bundled local plugins found in StripBot's repository:

| ID | Runtime dependency | Deployment decision |
|---|---|---|
| `archive-7zip` | Reads/writes local files, runs 7-Zip | Keep local; a cloud version would require authenticated file upload/download and resource controls |
| `office-pdf` | Reads/writes local files, runs LibreOffice | Keep local; a cloud version would require isolated conversion workers and file retention policy |
| `deepseek-harness-pet` | Launches a desktop pet | Must run on the user's computer |
| `nono-desktop` | Local desktop pet window | Must run on the user's computer |

Do not delete the local versions before an equivalent, tested cloud implementation exists.

## Verify deployment

On Render Deploys, the service should show **Live**, with logs saying `MCP server listening on 8080`.

Opening `/mcp` in a normal browser returns Unauthorized without an Authorization header; this is correct behavior. Health checks on `/health` do not require authentication. GitHub Actions workflow `StripBot Cloud MCP checks` runs read-only client/server tests and TypeScript checks.

## Security notes

- The token is never copied into Agent MCP configuration, never passed in the URL, and is erased from the in-memory credential map when the connection is removed.
- A tool's name is not a security boundary. The backend explicitly allows only `service_status` for this pinned cloud service.
- The audit file `.runtime/mcp-cloud-audit.jsonl` stores event metadata only (time, action, outcome, request ID).
- A future multi-user public MCP deployment requires proper per-user credentials, rate limits, usage quotas, plugin sandboxing, persistent storage and HTTPS configuration; Render free tier may sleep.
