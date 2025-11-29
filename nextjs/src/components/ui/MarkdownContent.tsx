// nextjs/src/components/ui/MarkdownContent.tsx
"use client";

import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
    children: string;
    className?: string;
}

export default function MarkdownContent({ children, className = "" }: MarkdownContentProps) {
    return (
        <ReactMarkdown
            className={`prose prose-slate max-w-none ${className}`}
            components={{
                h2: ({ children }) => (
                    <h2 className="text-lg font-semibold text-slate-900 mt-6 mb-3 first:mt-0">
                        {children}
                    </h2>
                ),
                h3: ({ children }) => (
                    <h3 className="text-md font-medium text-slate-800 mt-4 mb-2">
                        {children}
                    </h3>
                ),
                p: ({ children }) => (
                    <p className="text-slate-700 mb-3 leading-relaxed">
                        {children}
                    </p>
                ),
                ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-3 text-slate-700 space-y-1">
                        {children}
                    </ul>
                ),
                ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-3 text-slate-700 space-y-1">
                        {children}
                    </ol>
                ),
                li: ({ children }) => (
                    <li className="text-slate-700">
                        {children}
                    </li>
                ),
                strong: ({ children }) => (
                    <strong className="font-semibold text-slate-900">
                        {children}
                    </strong>
                ),
                em: ({ children }) => (
                    <em className="italic text-slate-700">
                        {children}
                    </em>
                ),
                // Disable code blocks and other complex formatting
                code: ({ children }) => (
                    <span className="font-medium text-slate-800">
                        {children}
                    </span>
                ),
                pre: ({ children }) => (
                    <div className="text-slate-700">
                        {children}
                    </div>
                )
            }}
        >
            {children}
        </ReactMarkdown>
    );
}