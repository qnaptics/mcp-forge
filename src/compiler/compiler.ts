/*
 **
 * MCP Forge
 *
 * Build MCP servers without writing MCP servers
 *
 * Copyright (c) 2026 Qnaptics
 * SPDX-License-Identifier: MIT
 *
 * Author: Qnaptics
 * GitHub: https://github.com/qnaptics
 * Contact: qnaptics@gmail.com
 *
 * Licensed under the MIT License.
 * See the LICENSE file in the project root for license information.
 *
 **/

import fs from "node:fs";
import path from "node:path";
import type { MCPDefinition } from "../schema/definition";

export function compile(
  definition: MCPDefinition,
  outputRoot = "./dist"
): string {
  const outputDir = path.join(outputRoot, definition.server.name);

  fs.mkdirSync(outputDir, { recursive: true });

  const serverCode = generateServer(definition);
  const packageJson = generatePackageJson(definition);
  const readme = generateReadme(definition);

  fs.writeFileSync(
    path.join(outputDir, "server.js"),
    serverCode,
    "utf8"
  );

  fs.writeFileSync(
    path.join(outputDir, "package.json"),
    packageJson,
    "utf8"
  );

  fs.writeFileSync(
    path.join(outputDir, "README.md"),
    readme,
    "utf8"
  );

  return outputDir;
}

function generateServer(definition: MCPDefinition): string {
  const toolRegistrations = definition.tools
    .map((tool) => {
      const inputSchema = generateInputSchema(tool.input);
      const implementation = generateAction(tool);

      return `
server.tool(
  ${JSON.stringify(tool.name)},
  ${JSON.stringify(tool.description)},
  ${inputSchema},
  async (args) => {
${implementation}
  }
);
`;
    })
    .join("\n");

  return `\
const fs = require("node:fs/promises");
const path = require("node:path");

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

const server = new McpServer({
  name: ${JSON.stringify(definition.server.name)},
  version: "0.1.0"
});

${toolRegistrations}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;
}

function generateAction(
  tool: MCPDefinition["tools"][number]
): string {
  const actionType = tool.action?.type;

  switch (actionType) {
    case "filesystem.tail":
      return generateFilesystemTail();

    default:
      return `
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tool: ${JSON.stringify(tool.name)},
            status: "not_implemented",
            message: "No compiler implementation exists for this action."
          }, null, 2)
        }
      ]
    };
`;
  }
}

function generateFilesystemTail(): string {
  return `
    try {
      const requestedPath = args.log_path;
      const requestedLines = args.lines;

      const root = process.cwd();
      const resolvedPath = path.resolve(root, requestedPath);
      const relativePath = path.relative(root, resolvedPath);

      // Prevent filesystem traversal outside the generated server directory.
      if (
        relativePath.startsWith("..") ||
        path.isAbsolute(relativePath)
      ) {
        throw new Error("Access denied: path must remain inside the working directory.");
      }

      const contents = await fs.readFile(resolvedPath, "utf8");

      const lines = contents
        .split(/\\r?\\n/)
        .filter((line) => line.length > 0);

      const tail = lines.slice(-requestedLines);

      return {
        content: [
          {
            type: "text",
            text: tail.join("\\n")
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error instanceof Error
                ? error.message
                : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
`;
}

function generateInputSchema(
  input: Record<
    string,
    {
      type: string;
      default?: unknown;
      min?: number;
      max?: number;
    }
  > | undefined
): string {
  if (!input || Object.keys(input).length === 0) {
    return "{}";
  }

  const properties = Object.entries(input)
    .map(([name, definition]) => {
      let expression = getZodType(definition.type);

      if (
        definition.type === "integer" &&
        definition.min !== undefined
      ) {
        expression += `.int().min(${definition.min})`;
      } else if (definition.type === "integer") {
        expression += `.int()`;
      }

      if (
        definition.type === "integer" &&
        definition.max !== undefined
      ) {
        expression += `.max(${definition.max})`;
      }

      if (definition.default !== undefined) {
        expression += `.default(${JSON.stringify(definition.default)})`;
      }

      return `    ${JSON.stringify(name)}: ${expression}`;
    })
    .join(",\n");

  return `{
  ${properties}
}`;
}

function getZodType(type: string): string {
  switch (type) {
    case "string":
      return "z.string()";

    case "integer":
      return "z.number()";

    case "number":
      return "z.number()";

    case "boolean":
      return "z.boolean()";

    default:
      return "z.any()";
  }
}

function generatePackageJson(
  definition: MCPDefinition
): string {
  return JSON.stringify(
    {
      name: definition.server.name,
      version: "0.1.0",
      private: true,
      description: definition.server.description,
      main: "server.js",
      type: "commonjs",
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.0.0",
        "zod": "^4.5.4"
      }
    },
    null,
    2
  );
}

function generateReadme(
  definition: MCPDefinition
): string {
  const tools = definition.tools
    .map(
      (tool) =>
        `### ${tool.name}\n\n${tool.description}\n`
    )
    .join("\n");

  return `# ${definition.server.name}

${definition.server.description}

## Tools

${tools}

## Run

Install dependencies:

\`\`\`bash
npm install
\`\`\`

Start the MCP server:

\`\`\`bash
node server.js
\`\`\`
`;
}
