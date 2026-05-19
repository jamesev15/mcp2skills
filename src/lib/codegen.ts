import type { McpTool, JsonSchemaProperty } from '@/types';

function stringifyLiteral(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return 'unknown';
}

function resolveSchemaRef(ref: string, rootSchema?: JsonSchemaProperty): JsonSchemaProperty | undefined {
  if (!rootSchema) return undefined;
  if (!ref.startsWith('#/')) return undefined;

  const parts = ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: unknown = rootSchema;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (!current || typeof current !== 'object') return undefined;
  return current as JsonSchemaProperty;
}

export function jsonSchemaPropToTsType(
  prop: JsonSchemaProperty | undefined,
  depth = 0,
  rootSchema?: JsonSchemaProperty
): string {
  if (!prop) return 'unknown';
  if (depth > 5) return 'unknown';
  const effectiveRoot = rootSchema ?? prop;

  const refValue = typeof prop.$ref === 'string' ? prop.$ref : undefined;
  if (refValue) {
    const resolved = resolveSchemaRef(refValue, effectiveRoot);
    if (resolved) {
      return jsonSchemaPropToTsType(resolved, depth + 1, effectiveRoot);
    }
  }

  if (prop.const !== undefined) {
    return stringifyLiteral(prop.const);
  }

  if (prop.enum) {
    const literals = prop.enum.map((v) => stringifyLiteral(v)).join(' | ');
    return literals || 'unknown';
  }

  if (prop.anyOf?.length) {
    return prop.anyOf.map((item) => jsonSchemaPropToTsType(item, depth + 1, effectiveRoot)).join(' | ');
  }
  if (prop.oneOf?.length) {
    return prop.oneOf.map((item) => jsonSchemaPropToTsType(item, depth + 1, effectiveRoot)).join(' | ');
  }
  if (prop.allOf?.length) {
    return prop.allOf.map((item) => jsonSchemaPropToTsType(item, depth + 1, effectiveRoot)).join(' & ');
  }

  let baseType: string;
  switch (prop.type) {
    case 'string':
      baseType = 'string';
      break;
    case 'number':
    case 'integer':
      baseType = 'number';
      break;
    case 'boolean':
      baseType = 'boolean';
      break;
    case 'null':
      baseType = 'null';
      break;
    case 'array': {
      if (prop.items) {
        baseType = `Array<${jsonSchemaPropToTsType(prop.items, depth + 1, effectiveRoot)}>`;
        break;
      }
      baseType = 'unknown[]';
      break;
    }
    case 'object': {
      if (prop.properties && Object.keys(prop.properties).length > 0) {
        const required = prop.required ?? [];
        const fields = Object.entries(prop.properties)
          .map(([k, v]) => {
            const optional = !required.includes(k) ? '?' : '';
            return `${k}${optional}: ${jsonSchemaPropToTsType(v, depth + 1, effectiveRoot)}`;
          })
          .join('; ');
        if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
          return `{ ${fields}; [key: string]: ${jsonSchemaPropToTsType(
            prop.additionalProperties,
            depth + 1,
            effectiveRoot
          )} }`;
        }
        return `{ ${fields} }`;
      }
      if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
        baseType = `Record<string, ${jsonSchemaPropToTsType(
          prop.additionalProperties,
          depth + 1,
          effectiveRoot
        )}>`;
        break;
      }
      baseType = 'Record<string, unknown>';
      break;
    }
    default:
      baseType = 'unknown';
      break;
  }

  if (prop.nullable && baseType !== 'null') {
    return `${baseType} | null`;
  }
  return baseType;
}

export function generateFunctionName(toolName: string): string {
  return toolName
    .split(/[-_]/)
    .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
    .join('');
}

function schemaToExpectedKind(schema: JsonSchemaProperty | undefined): string {
  if (!schema) return '"unknown"';
  const kind = schema.type;
  if (kind === 'object' || kind === 'array' || kind === 'string' || kind === 'number' || kind === 'integer' || kind === 'boolean' || kind === 'null') {
    return kind === 'integer' ? '"number"' : `"${kind}"`;
  }
  return '"unknown"';
}

export function generateTypeScriptWrapper(tool: McpTool, toolEndpointUrl: string): string {
  const fnName = generateFunctionName(tool.name);
  const props = tool.inputSchema.type === 'object' ? tool.inputSchema.properties ?? {} : {};
  const required = tool.inputSchema.type === 'object' ? tool.inputSchema.required ?? [] : [];

  const paramFields = Object.entries(props)
    .map(([k, v]) => {
      const optional = !required.includes(k) ? '?' : '';
      return `  ${k}${optional}: ${jsonSchemaPropToTsType(v)};`;
    })
    .join('\n');

  const hasParams = Object.keys(props).length > 0;
  const inferredInputType = jsonSchemaPropToTsType(tool.inputSchema);
  const paramsType = hasParams ? `{\n${paramFields}\n}` : inferredInputType;
  const paramsArg = hasParams ? 'params: Params' : 'params: Params = {}';
  const resultType = jsonSchemaPropToTsType(tool.outputSchema);
  const expectedResultKind = schemaToExpectedKind(tool.outputSchema);
  const endpointPath = new URL(toolEndpointUrl).pathname;
  const encodedEndpoint = JSON.stringify(endpointPath);

  const descLine = tool.description ? ` * ${tool.description}\n` : '';

  return `import { callMcpTool } from "./_shared";

const TOOL_PATH = ${encodedEndpoint};

type Params = ${paramsType};
type Result = ${resultType};

/**
${descLine} * Calls the proxied MCP tool \`${tool.name}\` via mcp2skills.
 */
export async function ${fnName}<T = Result>(${paramsArg}): Promise<T> {
  return callMcpTool<T>(TOOL_PATH, params, ${expectedResultKind});
}
`;
}

export function generateSharedTypeScriptHelper(baseUrl: string): string {
  const base = JSON.stringify(baseUrl);
  return `const FALLBACK_PROXY_BASE_URL = ${base};
const MCP_PROXY_BASE_URL = process.env.MCP_PROXY_BASE_URL ?? FALLBACK_PROXY_BASE_URL;
type ExpectedKind = "object" | "array" | "string" | "number" | "boolean" | "null" | "unknown";

function joinBaseAndPath(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : \`/\${path}\`;
  return \`\${normalizedBase}\${normalizedPath}\`;
}

function formatErrorBody(text: string): string {
  if (!text) return "No response body";
  try {
    const json = JSON.parse(text) as { error?: unknown; details?: unknown };
    if (typeof json.error === "string" && typeof json.details === "string") {
      return \`\${json.error} (\${json.details})\`;
    }
    if (typeof json.error === "string") {
      return json.error;
    }
  } catch {
    // Keep original text when body is not valid JSON.
  }
  return text;
}

function parseTextContentCandidate(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return undefined;
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return undefined;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;

  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const text = (item as { text?: unknown }).text;
    if (typeof text !== "string") continue;
    try {
      return JSON.parse(text);
    } catch {
      // Ignore non-JSON text entries and continue with the next one.
    }
  }

  return undefined;
}

function extractMcpResult(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid proxy payload: expected an object");
  }

  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") {
    throw new Error("Invalid proxy payload: missing result envelope");
  }

  const structuredContent = (result as { structuredContent?: unknown }).structuredContent;
  if (structuredContent !== undefined) {
    return structuredContent;
  }

  const parsedText = parseTextContentCandidate(payload);
  if (parsedText !== undefined) {
    return parsedText;
  }

  const keys = Object.keys(result as Record<string, unknown>);
  throw new Error(
    \`MCP result envelope did not include structuredContent or parsable content[].text. Available result keys: \${keys.join(", ") || "(none)"}\`
  );
}

function assertExpectedKind(value: unknown, expectedKind: ExpectedKind): void {
  if (expectedKind === "unknown") return;
  if (expectedKind === "null") {
    if (value !== null) {
      throw new Error(\`Output type mismatch: expected null, received \${Array.isArray(value) ? "array" : typeof value}\`);
    }
    return;
  }

  if (expectedKind === "array") {
    if (!Array.isArray(value)) {
      throw new Error(\`Output type mismatch: expected array, received \${value === null ? "null" : typeof value}\`);
    }
    return;
  }

  if (expectedKind === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(\`Output type mismatch: expected object, received \${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}\`);
    }
    return;
  }

  if (typeof value !== expectedKind) {
    throw new Error(\`Output type mismatch: expected \${expectedKind}, received \${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}\`);
  }
}

export async function callMcpTool<T>(
  endpointPath: string,
  args: Record<string, unknown>,
  expectedKind: ExpectedKind = "unknown"
): Promise<T> {
  const endpointUrl = joinBaseAndPath(MCP_PROXY_BASE_URL, endpointPath);
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arguments: args }),
  });

  if (!response.ok) {
    const errorText = formatErrorBody(await response.text());
    throw new Error(\`Tool call failed (\${response.status}): \${errorText}\`);
  }

  const payload = (await response.json()) as unknown;
  const extracted = extractMcpResult(payload);
  assertExpectedKind(extracted, expectedKind);
  return extracted as T;
}
`;
}

export function generateTypeScriptCodeRef(tool: McpTool, toolEndpointUrl: string): string {
  return generateTypeScriptWrapper(tool, toolEndpointUrl);
}
