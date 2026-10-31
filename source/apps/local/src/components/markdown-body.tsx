"use client";

import ReactMarkdown, { type Components, defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownBodyProps = {
  body: string;
  onToggleTask?: (index: number, checked: boolean) => void;
  taskUpdatesDisabled?: boolean;
};

const embeddedImageUrl = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z\d+/]+=*$/i;

export function MarkdownBody({
  body,
  onToggleTask,
  taskUpdatesDisabled = false,
}: MarkdownBodyProps) {
  let checkboxIndex = 0;
  const components: Components = {
    input: ({ type, checked, disabled, ...props }) => {
      if (type !== "checkbox") return <input type={type} disabled={disabled} {...props} />;
      const index = checkboxIndex;
      checkboxIndex += 1;
      return (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={!onToggleTask || taskUpdatesDisabled}
          aria-label={`Task checklist item ${index + 1}`}
          onChange={(event) => onToggleTask?.(index, event.currentTarget.checked)}
        />
      );
    },
  };

  return (
    <article className="task-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={(url) => (embeddedImageUrl.test(url) ? url : defaultUrlTransform(url))}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
