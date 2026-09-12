/*
 **
 * MCP Forge
 *
 * Build MCP servers without writing MCP servers
 *
 * Copyright (c) 2026 Qnatics 
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

import { z } from "zod";

const InputDefinition = z.object({
  type: z.enum(["string", "integer", "number", "boolean", "path"]),
  default: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  env: z.string().min(1).optional(),
  required: z.boolean().optional()
});

const ActionDefinition = z.object({
  type: z.enum([
    "filesystem.tail",
    "code.understand_architecture"
  ])
});

const ToolDefinition = z.object({
  name: z.string().min(1),
  description: z.string().min(1),

  input: z.record(z.string(), InputDefinition).optional(),

  action: ActionDefinition.optional(),

  execution: z.object({
    runtime: z.string().optional(),
    timeout: z.string().optional()
  }).optional()
});

export const MCPDefinition = z.object({
  server: z.object({
    name: z.string().min(1),
    description: z.string().min(1)
  }),

  tools: z.array(ToolDefinition).min(1)
});

export type MCPDefinition = z.infer<typeof MCPDefinition>;
