# MCP Forge

**Build MCP servers without writing MCP servers.**

MCP Forge is an open-source compiler and developer toolkit for creating, packaging, registering, and using [Model Context Protocol (MCP)] servers.

Define your tool in a simple declarative file.

```text
Definition → Validate → Forge → MCP Server → Register → Use
```

Instead of writing MCP boilerplate, developers describe what their tool does and let Forge generate the server.

---

## Why MCP Forge?

Creating an MCP server today often means dealing with:

- SDK boilerplate
- Input/output schemas
- Transport configuration
- Error handling
- Packaging
- Configuration for AI clients
- Server discovery and registration
- Permissions and credentials
- Deployment

MCP Forge aims to make this dramatically simpler.

### The goal

> **If you can define a tool, you should be able to ship an MCP server.**

---

## Quick Start

### Install

```bash
npm install -g mcp-forge
```

### Create a server

```bash
mcp-forge init
