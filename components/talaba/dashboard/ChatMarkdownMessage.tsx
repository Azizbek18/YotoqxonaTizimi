'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Renders an AI assistant reply: markdown -> sanitized HTML. */
export const ChatMarkdownMessage = React.memo(({ text }: { text: string }) => {
  const html = useMemo(() => {
    return DOMPurify.sanitize(String(marked.parse(text, { async: false })), {
      USE_PROFILES: { html: true },
    });
  }, [text]);
  return (
    <div
      className="break-words space-y-1 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-blue-500 [&_a]:underline [&_p]:my-1 [&_code]:bg-slate-200/50 [&_code]:dark:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
ChatMarkdownMessage.displayName = 'ChatMarkdownMessage';
