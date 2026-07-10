import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Markdown → sanitised HTML for guide bodies. Content is admin-authored, but we
 * still run it through an allowlist sanitiser (defence in depth: a compromised
 * admin, or AI-drafted text, can't inject <script>). GFM on, raw HTML in the
 * source is dropped by the sanitiser's tag allowlist.
 */
const ALLOWED_TAGS = [
  "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "blockquote",
  "strong", "em", "code", "pre", "hr", "br", "table", "thead",
  "tbody", "tr", "th", "td",
];

export function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false, gfm: true }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      // All links leave for external references — make them safe + open aware.
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  });
}

/** Plain-text excerpt fallback from Markdown (first ~155 chars, tags stripped). */
export function excerptFromMarkdown(md: string, max = 155): string {
  const text = sanitizeHtml(marked.parse(md, { async: false, gfm: true }) as string, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
