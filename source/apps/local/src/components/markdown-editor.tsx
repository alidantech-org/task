"use client";

import { Crepe } from "@milkdown/crepe";
import { useEffect, useRef } from "react";

type MarkdownEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onError?: (message: string) => void;
  className?: string;
};

const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const maxInlineImageBytes = 1_500_000;

function imageAsDataUrl(file: File): Promise<string> {
  if (!imageTypes.has(file.type)) {
    return Promise.reject(new Error("Choose a PNG, JPEG, GIF, WebP, or AVIF image."));
  }
  if (file.size > maxInlineImageBytes) {
    return Promise.reject(new Error("Markdown images must be 1.5 MB or smaller."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read this image."));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

export function MarkdownEditor({ value, onChange, onError, className }: MarkdownEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  onChangeRef.current = onChange;
  onErrorRef.current = onError;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const editor = new Crepe({
      root: element,
      defaultValue: value,
      features: {
        [Crepe.Feature.TopBar]: true,
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.Table]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: "Write in Markdown…", mode: "block" },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async (file) => {
            try {
              return await imageAsDataUrl(file);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Image upload failed.";
              onErrorRef.current?.(message);
              throw error;
            }
          },
        },
      },
    });
    editor.on((listener) => {
      listener.markdownUpdated((_context, markdown) => onChangeRef.current(markdown));
    });
    let disposed = false;
    const ready = editor.create();
    void ready.catch((error: unknown) => {
      if (!disposed) {
        onErrorRef.current?.(
          error instanceof Error ? error.message : "Markdown editor failed to load.",
        );
      }
    });
    return () => {
      disposed = true;
      void ready.then(() => editor.destroy()).catch(() => undefined);
    };
  }, []);

  return <div ref={root} className={`task-markdown-editor ${className ?? ""}`} />;
}
