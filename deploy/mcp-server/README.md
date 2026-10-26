# StripBot Read-only MCP Server

This is a minimal **deployable example**, not a live hosted endpoint.

## Run locally
```sh
MCP_ACCESS_TOKEN='replace-with-a-random-secret-at-least-24-chars' node server.cjs
```

## Container
```sh
docker build -t stripbot-mcp-readonly .
docker run --rm -p 127.0.0.1:8080:8080 -e MCP_ACCESS_TOKEN='replace-with-a-random-secret-at-least-24-chars' stripbot-mcp-readonly
```

For public access, deploy behind an HTTPS reverse proxy, configure a secret in your hosting platform, and enforce authentication and rate limits. Do not commit real tokens. The server exposes only `service_status`, a read-only demonstration tool. Production deployment requires cloud credentials and a domain; no public server has been deployed.
