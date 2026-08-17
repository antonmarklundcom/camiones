/**
 * Renders a JSON-LD object as an application/ld+json script tag.
 *
 * `<` is escaped to its < form because JSON.stringify does NOT escape it:
 * listing titles are built from the dealer's free-text `model` field and guide
 * excerpts feed Article JSON-LD, so a stored `</script>` would otherwise close
 * this tag early and execute whatever followed it on a public page.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
