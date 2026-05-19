'use client';

import type { McpTool } from '@/types';

interface Props {
  tools: McpTool[];
  compact?: boolean;
}

export default function ToolList({ tools, compact = false }: Props) {
  if (tools.length === 0) return <p className="text-sm text-gray-500">No tools found.</p>;

  return (
    <ul className={`mt-2 ${compact ? 'space-y-1.5' : 'space-y-2'}`}>
      {tools.map((tool) => (
        <li key={tool.name} className="rounded border border-gray-200 bg-white">
          <details>
            <summary
              className={`cursor-pointer font-mono font-medium hover:bg-gray-50 ${
                compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
              }`}
            >
              {tool.name}
              {tool.description && (
                <span className={`ml-2 font-sans font-normal text-gray-500 ${compact ? 'text-xs' : ''}`}>
                  — {tool.description}
                </span>
              )}
            </summary>
            <div className={`border-t border-gray-100 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
              {tool.inputSchema.properties &&
              Object.keys(tool.inputSchema.properties).length > 0 ? (
                <ul className="space-y-1 text-xs text-gray-600">
                  {Object.entries(tool.inputSchema.properties).map(([k, v]) => {
                    const isRequired = tool.inputSchema.required?.includes(k);
                    return (
                      <li key={k} className="font-mono">
                        <span className="text-blue-700">{k}</span>
                        {!isRequired && (
                          <span className="text-gray-400">?</span>
                        )}
                        <span className="text-gray-400">: </span>
                        <span className="text-green-700">{v.type ?? 'unknown'}</span>
                        {v.description && (
                          <span className="ml-2 font-sans text-gray-500">— {v.description}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">No parameters</p>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
