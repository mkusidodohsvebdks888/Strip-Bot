# StripBot MCP: GitHub + Render deployment

The GitHub repository holds the source. Render (or an equivalent free-tier container host) runs the MCP HTTP service. Free-tier availability, sleep behavior and quotas are subject to the provider's current offering.

1. In Render, create a **Blueprint** from this repository and select `render.yaml`. If the repository is private, grant Render access to it.
2. Confirm the generated `MCP_ACCESS_TOKEN` is stored as a Render secret; never put it in GitHub or screenshots.
3. Deploy and wait for `GET https://<render-host>/health` to return `{"ok":true}`.
4. Configure your MCP client with endpoint `https://<render-host>/mcp` and an Authorization header `Bearer <token>`.
5. Call `initialize`, `tools/list` and `tools/call` with tool `service_status`.
6. Keep cloud credentials separate from local desktop credentials. Do not expose local filesystem or shell execution tools through this public endpoint.

This is a **read-only demonstration server**. It does not move existing StripBot local plugins automatically, nor does it deploy without access to a Render account.

## Migration checklist

- Inventory each plugin and classify as cloud-safe or local-only using `plugin-policy.json`.
- For cloud-safe plugins, isolate their server-side logic, remove local-path dependencies and supply secrets via hosting environment variables.
- Register each reviewed tool with explicit permissions, authorization and rate limits.
- Test on the hosted endpoint, then switch the StripBot client to the remote MCP URL.
- Keep desktop-dependent features in a local companion process.

Never copy user data, tokens, SSH keys or `.runtime` contents into GitHub.
