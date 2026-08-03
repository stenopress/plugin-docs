# @steno/plugin-docs

Docs-mirroring plugin for [Steno](https://github.com/steno/steno) that copies a
directory of markdown files living outside your `contentDir` into your site as
regular pages, before every build.

This is for the common case where documentation lives in a `docs/` folder at the
repo root (so it's also readable directly on GitHub) but you still want it
published as part of your Steno site. If your docs already live under
`contentDir`, you don't need this plugin — Steno picks those up on its own.

## Installation

```yaml
# content/.steno/config.yml
plugins:
  - jsr:@steno/plugin-docs
```

## Options

```yaml
plugins:
  - package: jsr:@steno/plugin-docs
    options:
      sourceDir: docs-source
      targetDir: docs
      layout: docs
      descriptionTemplate: "{title}, from the documentation."
```

| Option                | Type     | Default                              | Description                                                                                          |
| --------------------- | -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `sourceDir`           | `string` | _Required_                           | Directory containing the source markdown files to mirror in.                                         |
| `targetDir`           | `string` | `"docs"`                             | Subdirectory of `contentDir` to write the mirrored pages into.                                       |
| `layout`              | `string` | `"docs"`                             | Frontmatter `layout` value injected into generated pages.                                            |
| `descriptionTemplate` | `string` | `"{title}, from the documentation."` | Description template for generated frontmatter; `{title}` is replaced with the page's derived title. |

## How it works

The plugin hooks into Steno's `beforeBuild` stage, which runs before Steno scans
`contentDir` for pages — so files it writes there are picked up by the normal
content pipeline like any other page.

On every build, for the configured `targetDir` (e.g. `content/docs/`), the
plugin:

1. Creates `targetDir` if it doesn't exist yet.
2. Removes every `.md` file directly inside `targetDir` (non-recursively —
   subdirectories and non-`.md` files, such as hand-placed images, are left
   alone) so stale pages never linger between builds.
3. Reads every `.md` file directly inside `sourceDir` (non-recursively):
   - If the file already starts with its own frontmatter block, it's copied
     through as-is, with only its markdown links rewritten (see below).
   - Otherwise, frontmatter is generated: `title` (from the first `# Heading` in
     the file, falling back to a humanized version of the filename),
     `description` (from `descriptionTemplate`), and `layout`.
4. Rewrites relative markdown links (`[text](other.md)` or
   `[text](other.md#anchor)`) into site routes under `targetDir`
   (`[text](/docs/other/#anchor)`), so links that work on GitHub also work on
   the built site. A link to `README.md` points at the section root (`/docs/`)
   instead of `/docs/readme/`.
5. Writes the result into `targetDir`, renaming `README.md` to `index.md`.

## License

MIT
