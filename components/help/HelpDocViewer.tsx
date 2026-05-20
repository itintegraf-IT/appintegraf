"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

type Props = {
  content: string;
};

/** Markdown z docs/ – typografie sladěná s aplikací */
export function HelpDocViewer({ content }: Props) {
  return (
    <article
      className="help-doc-prose max-w-none text-gray-800"
      style={{ lineHeight: 1.65 }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-0 text-2xl font-bold text-gray-900">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 border-b border-gray-200 pb-2 text-xl font-semibold text-gray-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-lg font-semibold text-gray-900">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>
          ),
          li: ({ children }) => <li className="text-gray-800">{children}</li>,
          a: ({ href, children }) => {
            const isExternal =
              href?.startsWith("http") || href?.startsWith("mailto:");
            if (href?.startsWith("/help/")) {
              return (
                <Link href={href} className="text-red-600 underline hover:text-red-700">
                  {children}
                </Link>
              );
            }
            if (href && !isExternal && (href.endsWith(".md") || href.includes("/docs/"))) {
              return (
                <span className="text-gray-600" title={href ?? undefined}>
                  {children}
                </span>
              );
            }
            return (
              <a
                href={href}
                className="text-red-600 underline hover:text-red-700"
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-900">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <TableScroll>
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </TableScroll>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-4 border-red-300 pl-4 italic text-gray-600">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 overflow-x-auto">{children}</div>;
}
