import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { join } from "@std/path";
import type { SiteConfig } from "steno";
import docsPlugin from "./mod.ts";

function makeDirs() {
  const sourceDir = Deno.makeTempDirSync();
  const contentDir = Deno.makeTempDirSync();
  return { sourceDir, contentDir };
}

Deno.test({
  name: "docs: throws an error if sourceDir is missing",
  fn: () => {
    assertThrows(
      // @ts-ignore testing runtime exception fallback safely
      () => docsPlugin({ sourceDir: "" }),
      Error,
      "Steno Docs Plugin: 'sourceDir' option is required.",
    );
  },
});

Deno.test({
  name: "docs: README.md becomes index.md with derived title and layout",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "README.md"),
        "# Getting Started\n\nSome intro text.\n",
      );

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const target = join(contentDir, "docs");
      const written = Deno.readTextFileSync(join(target, "index.md"));

      assertStringIncludes(written, 'title: "Getting Started"');
      assertStringIncludes(written, 'layout: "docs"');
      assertStringIncludes(
        written,
        'description: "Getting Started, from the documentation."',
      );
      assertStringIncludes(written, "Some intro text.");
      assert(!(await exists(join(target, "README.md"))));
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "docs: rewrites .md links to route links",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "guide.md"),
        "# Guide\n\nSee [foo](bar.md) for more.\n",
      );

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const written = Deno.readTextFileSync(
        join(contentDir, "docs", "guide.md"),
      );
      assertStringIncludes(written, "[foo](/docs/bar/)");
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "docs: link to README.md rewrites to the section root",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "guide.md"),
        "# Guide\n\nBack to [home](README.md).\n",
      );

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const written = Deno.readTextFileSync(
        join(contentDir, "docs", "guide.md"),
      );
      assertStringIncludes(written, "[home](/docs/)");
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "docs: title falls back to humanized filename when no heading present",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "some_topic-name.md"),
        "No heading here, just text.\n",
      );

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const written = Deno.readTextFileSync(
        join(contentDir, "docs", "some_topic-name.md"),
      );
      assertStringIncludes(written, 'title: "Some Topic Name"');
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "docs: source with own frontmatter is passed through, only links rewritten",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "custom.md"),
        `---
title: "Custom Title"
layout: special
custom_field: yes
---

Link to [other](other.md).
`,
      );

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const written = Deno.readTextFileSync(
        join(contentDir, "docs", "custom.md"),
      );
      assertStringIncludes(written, 'title: "Custom Title"');
      assertStringIncludes(written, "layout: special");
      assertStringIncludes(written, "custom_field: yes");
      assertStringIncludes(written, "[other](/docs/other/)");
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "docs: rerunning removes stale generated files but keeps hand-placed non-md assets",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "guide.md"),
        "# Guide\n\nContent.\n",
      );

      const target = join(contentDir, "docs");
      Deno.mkdirSync(target, { recursive: true });
      Deno.writeTextFileSync(join(target, "stale.md"), "stale content");
      Deno.writeTextFileSync(join(target, "logo.png"), "not markdown");

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      assert(!(await exists(join(target, "stale.md"))));
      assert(await exists(join(target, "logo.png")));
      assert(await exists(join(target, "guide.md")));
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "docs: only reads top-level .md files from sourceDir, ignoring others",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.mkdirSync(join(sourceDir, "nested"), { recursive: true });
      Deno.writeTextFileSync(join(sourceDir, "nested", "deep.md"), "# Deep\n");
      Deno.writeTextFileSync(join(sourceDir, "notes.txt"), "not markdown");
      Deno.writeTextFileSync(join(sourceDir, "top.md"), "# Top\n");

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const target = join(contentDir, "docs");
      const entries: string[] = [];
      for await (const entry of Deno.readDir(target)) {
        entries.push(entry.name);
      }

      assertEquals(entries, ["top.md"]);
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "docs: respects targetDir, layout, and descriptionTemplate options",
  fn: async () => {
    const { sourceDir, contentDir } = makeDirs();
    try {
      Deno.writeTextFileSync(
        join(sourceDir, "install.md"),
        "# Install\n\nRun the installer.\n",
      );

      const plugin = docsPlugin({
        sourceDir,
        targetDir: "guides",
        layout: "guide-layout",
        descriptionTemplate: "Learn about {title} here.",
      });
      await plugin.beforeBuild!({ contentDir } as unknown as SiteConfig);

      const written = Deno.readTextFileSync(
        join(contentDir, "guides", "install.md"),
      );

      assertStringIncludes(written, 'layout: "guide-layout"');
      assertStringIncludes(
        written,
        'description: "Learn about Install here."',
      );
      assert(!(await exists(join(contentDir, "docs", "install.md"))));
    } finally {
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(contentDir, { recursive: true });
    }
  },
});

Deno.test({
  name: 'docs: falls back to "content" when config.contentDir is not set',
  fn: async () => {
    const { sourceDir } = makeDirs();
    const originalCwd = Deno.cwd();
    const cwdRoot = Deno.makeTempDirSync();
    try {
      Deno.chdir(cwdRoot);
      Deno.writeTextFileSync(join(sourceDir, "page.md"), "# Page\n");

      const plugin = docsPlugin({ sourceDir });
      await plugin.beforeBuild!({} as unknown as SiteConfig);

      const written = Deno.readTextFileSync(
        join(cwdRoot, "content", "docs", "page.md"),
      );
      assertStringIncludes(written, 'title: "Page"');
    } finally {
      Deno.chdir(originalCwd);
      Deno.removeSync(sourceDir, { recursive: true });
      Deno.removeSync(cwdRoot, { recursive: true });
    }
  },
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
