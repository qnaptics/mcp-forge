#!/usr/bin/env node
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
import { spawn } from "node:child_process";
import { parse } from "yaml";

import { MCPDefinition } from "../schema/definition";
import { compile } from "../compiler/compiler";

const command = process.argv[2];
const file = process.argv[3];

function printUsage(): void {
  console.error("");
  console.error("Usage:");
  console.error("  mcp-forge build <definition.yaml>");
  console.error("  mcp-forge run <definition.yaml>");
  console.error("");
}

if (!command || !["build", "run"].includes(command)) {
  printUsage();
  process.exit(1);
}

if (!file) {
  console.error("Missing definition file.");
  printUsage();
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

try {
  const absolutePath = path.resolve(file);
  const contents = fs.readFileSync(absolutePath, "utf8");

  const raw = parse(contents);
  const definition = MCPDefinition.parse(raw);

  console.log("");
  console.log("🔥 MCP Forge");
  console.log("");

  console.log(`Server: ${definition.server.name}`);
  console.log(`Tools: ${definition.tools.length}`);
  console.log("");

  for (const tool of definition.tools) {
    console.log(`  ✓ ${tool.name}`);
  }

  console.log("");

  const outputDir = compile(definition);

  if (command === "build") {
    console.log("Compiling...");
    console.log("");
    console.log("✓ MCP server generated");
    console.log("");
    console.log(`Output: ${outputDir}`);
    console.log("");
    process.exit(0);
  }

  console.log("Starting MCP server...");
  console.log("");
  console.log(`Server: ${definition.server.name}`);
  console.log(`Path:   ${outputDir}/server.js`);
  console.log("");
  console.log("Waiting for MCP client connection...");
  console.log("Press Ctrl+C to stop.");
  console.log("");

  const server = spawn(
    process.execPath,
    ["server.js"],
    {
      cwd: outputDir,
      stdio: "inherit"
    }
  );

  server.on("error", (error) => {
    console.error("");
    console.error("✗ Failed to start MCP server");
    console.error("");
    console.error(error.message);
    process.exit(1);
  });

  server.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }

    process.exit(code ?? 0);
  });
} catch (error) {
  console.error("");
  console.error("✗ MCP Forge failed");
  console.error("");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exit(1);
}
