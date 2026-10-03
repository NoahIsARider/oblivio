# zhou fangyanuo works archive

This project is now a static portfolio archive rather than a bookmark index.

## the three pages

Each page carries a line of its own:

- `index.html` — *oblivion is freedom*
- `portfolio/index.html` — *I don't remember your face or your hair or your name or your smile*
- `amber/index.html` — *What disappears leaves a trace. What stays becomes amber.*

## what the build does

- reads `content/works-manifest.json`
- reads sanitized article fragments from `content/works/*.html`
- generates the homepage at `index.html`
- generates public detail pages at `works/*.html`
- writes deployable output to `dist/`

## source pipeline

Public article content is produced by:

- `scripts/import_works.py`

That script:

- reads the original Word documents
- converts legacy `.doc` files through Word automation when needed
- extracts embedded images
- removes sensitive cover information and course metadata
- writes cleaned fragments into `content/works/`

## useful folders

- `assets/works/`: extracted article images
- `content/works/`: sanitized HTML fragments
- `works/`: generated public article pages
- `dist/`: deployable static output

## commands

```bash
npm run build
```

Rebuilds the homepage, detail pages, and `dist/`.

```bash
python "scripts/import_works.py"
```

Re-imports the original documents, regenerates fragments, and refreshes extracted images.

## deployment note

Deploy the contents of `dist/` with the existing workflow in `.forgejo/workflows/deploy.yml`.
