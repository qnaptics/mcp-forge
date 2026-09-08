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
  version: "0.2.0"
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
      return generateFilesystemTail(tool);

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

function generateFilesystemTail(
  tool: MCPDefinition["tools"][number]
): string {
  const logPathInput = tool.input?.log_path;

  const envVariable = logPathInput?.env;
  const required = logPathInput?.required === true;

  const environmentResolution = envVariable
    ? `
      const envValue = process.env[${JSON.stringify(envVariable)}];

      if (
        (args.log_path === undefined || args.log_path === null || args.log_path === "") &&
        envValue !== undefined &&
        envValue !== ""
      ) {
        args.log_path = envValue;
      }
`
    : "";

  const requiredValidation = required
    ? `
      if (
        args.log_path === undefined ||
        args.log_path === null ||
        args.log_path === ""
      ) {
        throw new Error(
          ${JSON.stringify(
            envVariable
              ? `Missing required input "log_path". Provide it as a tool argument or set ${envVariable}.`
              : `Missing required input "log_path".`
          )}
        );
      }
`
    : "";

  return `
    try {
${environmentResolution}
${requiredValidation}

      const requestedPath = args.log_path;
      const requestedLines = args.lines;

      if (typeof requestedPath !== "string") {
        throw new Error("Invalid input: log_path must be a string.");
      }

      if (
        typeof requestedLines !== "number" ||
        !Number.isInteger(requestedLines) ||
        requestedLines < 1
      ) {
        throw new Error("Invalid input: lines must be an integer greater than or equal to 1.");
      }

      const root = process.cwd();

      let resolvedPath;

      if (path.isAbsolute(requestedPath)) {
        resolvedPath = path.normalize(requestedPath);
      } else {
        const relativePath = path.normalize(requestedPath);

        // Prevent relative path traversal outside the working directory.
        if (
          relativePath === ".." ||
          relativePath.startsWith(".." + path.sep)
        ) {
          throw new Error(
            "Access denied: relative path must remain inside the working directory."
          );
        }

        resolvedPath = path.resolve(root, relativePath);
      }

      const contents = await fs.readFile(
        resolvedPath,
        "utf8"
      );

      const lines = contents
        .split(/\\r?\\n/)
        .filter((line) => line.length > 0);

      const tail = lines.slice(
        -requestedLines
      );

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
      env?: string;
      required?: boolean;
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

      if (definition.type === "number") {
        if (definition.min !== undefined) {
          expression += `.min(${definition.min})`;
        }

        if (definition.max !== undefined) {
          expression += `.max(${definition.max})`;
        }
      }

      if (definition.default !== undefined) {
        expression += `.default(${JSON.stringify(definition.default)})`;
      }

      /*
       * Environment-backed inputs are optional from the MCP caller's
       * perspective because the generated server can resolve them from
       * process.env.
       *
       * Required validation happens at runtime after environment
       * resolution.
       */
      if (definition.env || definition.required !== true) {
        expression += `.optional()`;
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

    case "path":
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
      version: "0.2.0",
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
    .map((tool) => {
      const inputs = Object.entries(tool.input ?? {})
        .map(([name, input]) => {
          const envText = input.env
            ? ` — environment variable: \`${input.env}\``
            : "";

          const requiredText = input.required
            ? " — required"
            : "";

          const defaultText =
            input.default !== undefined
              ? ` — default: \`${String(input.default)}\``
              : "";

          return `- \`${name}\` (${input.type})${envText}${requiredText}${defaultText}`;
        })
        .join("\n");

      return `### ${tool.name}

${tool.description}

${inputs ? `Inputs:\n\n${inputs}\n` : ""}
`;
    })
    .join("\n");

  const environmentVariables = definition.tools
    .flatMap((tool) =>
      Object.entries(tool.input ?? {})
        .filter(([, input]) => input.env)
        .map(([name, input]) => ({
          name,
          env: input.env as string
        }))
    );

  const environmentSection =
    environmentVariables.length > 0
      ? `
## Environment Variables

${environmentVariables
  .map(
    ({ name, env }) =>
      `- \`${env}\` — provides the value for \`${name}\` when the tool caller does not provide it`
  )
  .join("\n")}
`
      : "";

  return `# ${definition.server.name}

${definition.server.description}

## Tools

${tools}
${environmentSection}
## Run

Install dependencies:

\`\`\`bash
npm install
\`\`\`

Set required environment variables if needed:

\`\`\`bash
export APP_LOG_PATH="/absolute/path/to/app.log"
\`\`\`

Start the MCP server:

\`\`\`bash
node server.js
\`\`\`
`;
}