export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchemaProperty[];
  oneOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  nullable?: boolean;
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: JsonSchemaProperty;
  outputSchema?: JsonSchemaProperty;
}

export type TransportType = 'streamable-http' | 'sse';

export interface AuthConfig {
  type: 'none' | 'bearer';
  token?: string;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  owner?: string;
  transport?: TransportType;
  auth?: AuthConfig;
  status?: 'active' | 'error';
  tools?: McpTool[];
  lastDiscoveredAt?: string;
  error?: string;
}

export interface RegisterServerRequest {
  name: string;
  url: string;
  owner?: string;
  transport?: TransportType;
  auth?: AuthConfig;
}

export interface DiscoverToolsResponse {
  tools: McpTool[];
  discoveredAt: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
