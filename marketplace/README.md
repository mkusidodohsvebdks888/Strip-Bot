# StripBot Plugin & MCP Marketplace

This directory is a **distribution registry**, not a running MCP server.

## Registry
`registry.json` contains `plugins` and `mcpServers` arrays. Entries must be reviewed before publishing.

Plugin entry example:
```json
{"id":"example-plugin","name":"Example Plugin","version":"1.0.0","description":"Demo","repository":"https://github.com/OWNER/REPO","manifest":"https://raw.githubusercontent.com/OWNER/REPO/main/strip-plugin.json"}
```

MCP entry example:
```json
{"id":"example-mcp","name":"Example MCP","version":"1.0.0","description":"Demo","repository":"https://github.com/OWNER/REPO","transport":"streamable-http","endpoint":"https://mcp.example.com/mcp","access":"authenticated"}
```

Do not publish secrets, local filesystem paths, private service URLs or credentials. A public registry listing is **not** authorization to execute a plugin or connect to an MCP endpoint. Installations should require explicit user confirmation, integrity checks, and permission review.

## Deployment
GitHub hosts source, releases and static catalog data. A live remote MCP server must run on separate infrastructure (container, VM or application host), use HTTPS and authenticate clients. GitHub Actions can test and build, but cannot host an always-on MCP service.

The parent Strip-Bot repository is currently **private**. Nothing in this directory changes repository visibility or creates a public endpoint.
