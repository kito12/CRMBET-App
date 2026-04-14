"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  text: string;
  size?: number;
}

export default function CopyButton({ text, size = 12 }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${text}`}
      className="inline-flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all duration-150 flex-shrink-0"
      style={{ color: copied ? "#10b981" : "#48484a" }}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}
