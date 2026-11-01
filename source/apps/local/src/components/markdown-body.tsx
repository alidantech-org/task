"use client";

import { type LinkContext, resolveLink } from "@task/workspace/links/resolve";
import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components, defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeViewer } from "@/components/code-viewer";
import { internalHref } from "@/lib/link-context";

type MarkdownBodyProps = {
  body: string;
  onToggleTask?: (index: number, checked: boolean) => void;
  taskUpdatesDisabled?: boolean;
  className?: string;
  headingAnchors?: boolean;
  knownWikiLinks?: readonly string[];
  onWikiLink?: (id: string) => void;
  /** Enables opening documents, project files and anchors from relative links and ids. */
  linkContext?: LinkContext;
  onNavigate?: (href: string) => void;
};

const embeddedImageUrl = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z\d+/]+=*$/i;

function headingText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return headingText(node.props.children);
  return "";
}

export function MarkdownBody({
  body,
  onToggleTask,
  taskUpdatesDisabled = false,
  className = "",
  headingAnchors = false,
  knownWikiLinks = [],
  onWikiLink,
  linkContext,
  onNavigate,
}: MarkdownBodyProps) {
  let checkboxIndex = 0;
  const headingCounts = new Map<string, number>();
  const anchorForHeading = (children: ReactNode) => {
    const text = Children.toArray(children).map(headingText).join("");
    const slug = `h-${text
      .toLocaleLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    const occurrence = headingCounts.get(slug) ?? 0;
    headingCounts.set(slug, occurrence + 1);
    return occurrence ? `${slug}-${occurrence + 1}` : slug;
  };
  const heading =
    (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
    ({ children, ...props }: { children?: ReactNode }) => (
      <Tag {...props} id={headingAnchors ? anchorForHeading(children) : undefined}>
        {children}
      </Tag>
    );
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
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    h5: heading("h5"),
    h6: heading("h6"),
    a: ({ href, children, node: _node, ...props }) => {
      if (href?.startsWith("task-link:")) {
        const id = decodeURIComponent(href.slice("task-link:".length));
        const known = knownWikiLinks.includes(id);
        return (
          <button
            type="button"
            className={`wl ${known ? "" : "bad"}`}
            title={known ? `Open ${id}` : `No file named ${id}`}
            onClick={() => onWikiLink?.(id)}
          >
            {id}
          </button>
        );
      }
      if (href && linkContext) {
        const target = resolveLink(href, linkContext);
        if (target.kind === "blocked")
          return (
            <span className="bad-link" title="This link is not allowed">
              {children}
            </span>
          );
        const internal = internalHref(target);
        if (internal)
          return (
            <a
              href={internal}
              onClick={(event) => {
                if (
                  !onNavigate ||
                  target.kind === "anchor" ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey
                )
                  return;
                event.preventDefault();
                onNavigate(internal);
              }}
              {...props}
            >
              {children}
            </a>
          );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
    pre: ({ children, node: _node, ...props }) => {
      const child = Children.toArray(children)[0];
      if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
        const language = /language-([\w+-]+)/.exec(child.props.className ?? "")?.[1] ?? "text";
        return (
          <CodeViewer
            code={headingText(child.props.children).replace(/\n$/, "")}
            language={language}
            compact
          />
        );
      }
      return <pre {...props}>{children}</pre>;
    },
    table: ({ children, node: _node, ...props }) => (
      <div className="tw">
        <table {...props}>{children}</table>
      </div>
    ),
  };
  let inCodeFence = false;
  const markdown = body
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence;
        return line;
      }
      if (inCodeFence) return line;
      return line.replace(/\[\[([^\]]+)\]\]/g, (_match, id: string) => {
        return `[${id}](task-link:${encodeURIComponent(id)})`;
      });
    })
    .join("\n");

  return (
    <article className={`task-markdown ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={(url) =>
          url.startsWith("task-link:") || embeddedImageUrl.test(url)
            ? url
            : defaultUrlTransform(url)
        }
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
