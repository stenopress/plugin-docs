/**
 * Steno plugin for mirroring an external directory of markdown files into
 * `contentDir` before the build, so they're picked up as regular pages.
 */
import type { SiteConfig, StenoPlugin } from "steno";
import { basename, join } from "@std/path";

/** Options for the docs mirroring plugin. */
export interface DocsPluginOptions {
  /** Directory containing source markdown files to mirror in. Required. */
  sourceDir: string;
  /** Subdirectory of contentDir to write into. Default "docs". */
  targetDir?: string;
  /** Frontmatter `layout` value injected into generated pages. Default "docs". */
  layout?: string;
  /**
   * Description template; `{title}` is replaced with the derived page title.
   * Default `"{title}, from the documentation."`
   */
  descriptionTemplate?: string;
}

function titleFromMarkdown(markdown: string, fileName: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return basename(fileName, ".md")
    .replaceAll(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rewriteLinks(markdown: string, linkBase: string): string {
  return markdown.replace(
    /\]\((?!https?:|#)([^)]+?)\.md(#[^)]+)?\)/g,
    (_match, path: string, anchor = "") => {
      const name = basename(path);
      const route = name === "README" ? linkBase : `${linkBase}${name}/`;
      return `](${route}${anchor})`;
    },
  );
}

/** Creates a Steno plugin that mirrors markdown from `sourceDir` into `contentDir`. */
export default function docsPlugin(options: DocsPluginOptions): StenoPlugin {
  if (!options.sourceDir) {
    throw new Error("Steno Docs Plugin: 'sourceDir' option is required.");
  }

  const sourceDir = options.sourceDir;
  const targetSubDir = options.targetDir ?? "docs";
  const layout = options.layout ?? "docs";
  const descriptionTemplate = options.descriptionTemplate ??
    "{title}, from the documentation.";
  const linkBase = `/${targetSubDir}/`;

  return {
    name: "steno-plugin-docs",

    async beforeBuild(config: SiteConfig): Promise<void> {
      const contentDir = config.contentDir || "content";
      const target = join(contentDir, targetSubDir);

      await Deno.mkdir(target, { recursive: true });

      for await (const entry of Deno.readDir(target)) {
        if (entry.isFile && entry.name.endsWith(".md")) {
          await Deno.remove(join(target, entry.name));
        }
      }

      for await (const entry of Deno.readDir(sourceDir)) {
        if (!entry.isFile || !entry.name.endsWith(".md")) continue;

        const source = await Deno.readTextFile(join(sourceDir, entry.name));
        const outputName = entry.name === "README.md" ? "index.md" : entry.name;

        let generated: string;
        if (/^---\n/.test(source)) {
          // Author-supplied frontmatter: leave it untouched, only rewrite links.
          generated = rewriteLinks(source, linkBase);
        } else {
          const title = titleFromMarkdown(source, entry.name);
          const description = descriptionTemplate.replace("{title}", title);
          generated = `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
layout: ${JSON.stringify(layout)}
---

${rewriteLinks(source, linkBase)}
`;
        }

        await Deno.writeTextFile(join(target, outputName), generated);
      }
    },
  };
}
