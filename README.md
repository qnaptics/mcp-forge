# MCP Forge

** Build MCP servers without writing MCP servers.**

MCP Forge is an open-source declarative compiler for building MCP (Model Context Protocol) servers.

Define a server and its capabilities in YAML. Forge validates the definition and generates a runnable MCP server that can be used by MCP-compatible clients such as VS Code, Claude, and other AI development environments.

```text
Define → Validate → Compile → Test → Use
```

## Quick Start

### Install

```bash
npm install @qnaptics/mcp-forge
```

Or use it directly:

```bash
npx @qnaptics/mcp-forge --help
```

The CLI command is:

```bash
mcp-forge
```

---

## Example: Project Intelligence

MCP Forge includes a **Project Intelligence** example that creates an MCP server for understanding a local codebase.

Instead of writing an MCP server by hand, the capability is defined declaratively:

```yaml
server:
  name: project-intelligence
  description: Understand the architecture and structure of a local codebase

tools:
  - name: understand_architecture
    description: Analyze the current codebase and explain its architecture, major components, interactions, and business logic

    input:
      root_path:
        type: path
        env: PROJECT_ROOT
        required: true

    execution:
      runtime: node
      timeout: 30s

    action:
      type: code.understand_architecture
```

The complete example is available at:

```text
examples/project_intelligence.yaml
```

### Try it

Clone the repository:

```bash
git clone https://github.com/qnaptics/mcp-forge.git
cd mcp-forge
```

Compile the example:

```bash
npx @qnaptics/mcp-forge build examples/project_intelligence.yaml
```

This generates a runnable MCP server:

```text
dist/project-intelligence/
└── server.js
```

Run it:

```bash
PROJECT_ROOT="$PWD" \
npx @qnaptics/mcp-forge run examples/project_intelligence.yaml
```

You should see:

```text
🔥 MCP Forge

Server: project-intelligence

Tools: 1

  ✓ understand_architecture

Starting MCP server...

Server: project-intelligence

Path: dist/project-intelligence/server.js

Waiting for MCP client connection...
```

The generated server is now ready for an MCP client.

---

## Use with VS Code

The generated server can be connected directly to VS Code.

Create:

```text
.vscode/mcp.json
```

with:

```json
{
  "servers": {
    "project-intelligence": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${workspaceFolder}/dist/project-intelligence/server.js"
      ],
      "env": {
        "PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

After enabling the MCP server in VS Code, you can ask:

```text
Understand the architecture of this project.
```

or:

```text
What are the major components and how do they interact?
```

---

## How It Works

A Forge definition goes through a simple pipeline:

```text
YAML Definition
      │
      ▼
   Validate
      │
      ▼
    Compile
      │
      ▼
Generated MCP Server
      │
      ▼
 MCP Client
      │
      ▼
   AI Agent
```

Forge handles the MCP server implementation while the developer describes the desired capability declaratively.

---

## Current Capabilities

MCP Forge currently includes capabilities such as:

### Project Intelligence

```text
code.understand_architecture
```

Inspect a local codebase and return structured project information.

### Filesystem

```text
filesystem.tail
```

Read recent information from a local log or file.

---

## Included Examples

### Project Intelligence

```text
examples/project_intelligence.yaml
```

Understand the structure of a local codebase through MCP.

### Log Sentinel

```text
examples/log-sentinel.yaml
```

Extract recent application errors from local logs.

These examples are included in the MCP Forge repository to demonstrate how declarative definitions can produce useful MCP servers.

---

## CLI

The current CLI provides two commands:

```bash
mcp-forge build <definition.yaml>
mcp-forge run <definition.yaml>
```

### Build

```bash
npx @qnaptics/mcp-forge build examples/project_intelligence.yaml
```

### Run

```bash
npx @qnaptics/mcp-forge run examples/project_intelligence.yaml
```

---

## Development

Clone the repository:

```bash
git clone https://github.com/qnaptics/mcp-forge.git
cd mcp-forge
```

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run Forge directly from source:

```bash
npm run dev -- build examples/project_intelligence.yaml
```

---

## Design Principles

### Declarative

Describe capabilities rather than writing MCP protocol boilerplate.

### Controlled capabilities

Forge definitions use supported capabilities rather than arbitrary code embedded in YAML.

### Local-first

Generated MCP servers can run locally alongside your project.

### MCP-native

Forge generates MCP servers that can be consumed by MCP-compatible clients.

