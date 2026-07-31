"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="global-search" ref={root}>
      <label className="search">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Rechercher</span>
        <input
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 2) {
              setResults([]);
              setOpen(false);
              setLoading(false);
            } else {
              setLoading(true);
            }
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Mission, client, test, demande…"
          type="search"
          value={query}
        />
        <kbd>⌘ K</kbd>
      </label>
      {open ? (
        <div className="search-results" role="listbox">
          {loading ? <p>Recherche…</p> : null}
          {!loading && !results.length ? <p>Aucun résultat</p> : null}
          {results.map((result) => (
            <Link href={result.href} key={result.id} onClick={() => setOpen(false)}>
              <span>{result.kind}</span>
              <strong>{result.title}</strong>
              <small>{result.subtitle}</small>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
