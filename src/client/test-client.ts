import fs from "node:fs";
import path from "node:path";

import {
  Client
} from "@modelcontextprotocol/sdk/client/index.js";

import {
  StdioClientTransport
} from "@modelcontextprotocol/sdk/client/stdio.js";

export interface TestResult {
  success: boolean;
  toolsFound: string[];
  resultText?: string;
  error?: string;
}

export async function testMCPServer(
  serverPath: string,
  outputDir: string,
  toolName: string,
  toolArguments: Record<string, unknown>
): Promise<TestResult> {
  if (!fs.existsSync(serverPath)) {
    return {
      success: false,
      toolsFound: [],
      error: `Generated server not found: ${serverPath}`
    };
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: outputDir,
    env: process.env as Record<string, string>
});

  const client = new Client({
    name: "mcp-forge-test-client",
    version: "0.2.0"
  });

  try {
    console.log("✓ MCP server started");

    await client.connect(transport);

    console.log("✓ MCP handshake successful");

    const response = await client.listTools();

    const tools = response.tools ?? [];
    const toolsFound = tools.map((tool) => tool.name);

    if (!toolsFound.includes(toolName)) {
      return {
        success: false,
        toolsFound,
        error: `Expected tool "${toolName}" was not discovered`
      };
    }

    console.log(`✓ Tool discovered: ${toolName}`);

    const result = await client.callTool({
      name: toolName,
      arguments: toolArguments
    });

    if (result.isError) {
      return {
        success: false,
        toolsFound,
        error: `Tool invocation returned an error: ${JSON.stringify(result)}`
      };
    }

    console.log("✓ Tool invocation successful");

    const resultText = extractText(result);

    if (!resultText.trim()) {
      return {
        success: false,
        toolsFound,
        error: "Tool returned an empty result"
      };
    }
    
    const requiredEvidence = [
  '"root"',
  '"fileCount"',
  '"files"'
];

for (const field of requiredEvidence) {
  if (!resultText.includes(field)) {
    return {
      success: false,
      toolsFound,
      error: `Architecture result missing required evidence field: ${field}`
    };
  }
}

console.log("✓ Architecture evidence validated");

    console.log("✓ Result validated");

    return {
      success: true,
      toolsFound,
      resultText
    };
  } catch (error) {
    return {
      success: false,
      toolsFound: [],
      error: error instanceof Error
        ? error.message
        : String(error)
    };
  } finally {
    try {
      await transport.close();
    } catch {
      // Ignore transport shutdown errors during testing.
    }
  }
}

  function extractText(result: any): string {
  if (!Array.isArray(result?.content)) {
    return "";
  }

  return result.content
    .filter((item: any) => item?.type === "text")
    .map((item: any) => item?.text ?? "")
    .join("\n");
}

async function main(): Promise<void> {
  const outputDir = path.resolve(
    process.argv[2] ?? "dist/local-log-sentinel"
  );

  const serverPath = path.join(outputDir, "server.js");

  console.log("");
  console.log("🔥 MCP Forge Test Client");
  console.log("");

  const result = await testMCPServer(
    serverPath,
    outputDir,
    "understand_architecture",
    {
      root_path: process.env.PROJECT_ROOT ?? process.cwd()
    }
  );

  console.log("");

  if (!result.success) {
    console.error("✗ TEST FAILED");
    console.error("");
    console.error(result.error);
    console.error("");
    process.exit(1);
  }

  console.log("TEST PASSED");
  console.log("");
  console.log(result.resultText);
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("✗ MCP Forge Test Client failed");
  console.error("");

  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exit(1);
});
