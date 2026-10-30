"use client";

import { useEffect, useRef } from "react";

/**
 * A demo email in a frame as tall as the email, so nothing is cut off and there
 * is no second scrollbar. Still no scripts in the frame; allow-same-origin only
 * lets this page read the email's height (a frame that can't run script can't
 * use that access).
 */
export function EmailFrame({ title, html }: { title: string; html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const watcher = useRef<ResizeObserver>();

  const fit = () => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;
    // + the frame's own border, or a 2px inner scrollbar is left.
    const size = () => {
      frame.style.height = `${doc.documentElement.scrollHeight + frame.offsetHeight - frame.clientHeight}px`;
    };
    size();
    // Images or fonts that arrive later change the height; follow them.
    watcher.current?.disconnect();
    watcher.current = new ResizeObserver(size);
    watcher.current.observe(doc.body);
  };

  // The srcDoc often finishes loading before React attaches onLoad: size it now too.
  useEffect(() => {
    if (ref.current?.contentDocument?.readyState === "complete") fit();
    return () => watcher.current?.disconnect();
  }, []);

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={html}
      onLoad={fit}
      className="h-[640px] w-full rounded-lg border border-outline-variant bg-white"
    />
  );
}
