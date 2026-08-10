import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");
const worksDir = path.join(rootDir, "works");
const contentDir = path.join(rootDir, "content");
const contentWorksDir = path.join(contentDir, "works");
const manifestPath = path.join(contentDir, "works-manifest.json");
const stylesPath = path.join(rootDir, "styles.css");
const iconName = "icon.png";
const backgroundName = "background.png";

const categoryMeta = {
  essays: {
    id: "essays",
    title: "Essays",
    note: "Longer critical essays, paper-like arguments, and literary analysis kept in a public reading edition.",
    span: "wide",
    position: "top-left",
  },
  research: {
    id: "research-and-analysis",
    title: "Research and Analysis",
    note: "Course-derived research pieces, market analysis, ethics writing, and applied investigations with sensitive context removed.",
    span: "wide",
    position: "top-right",
  },
  writing: {
    id: "writing",
    title: "Writing",
    note: "Shorter reflective pieces, personal prose, and idea sketches that sit beside the more formal essays.",
    span: "standard",
    position: "bottom-left",
  },
  project: {
    id: "Projects and Systems",
    title: "Projects and Systems",
    note: "Project reports and engineering-oriented work where the article page preserves the full structure and images from the source document.",
    span: "standard",
    position: "bottom-center",
  },
  talk: {
    id: "Talks and Presentation",
    title: "Talks and Presentation",
    note: "Speech drafts, presentations, and public-facing scripts adapted into the same reading archive.",
    span: "standard",
    position: "bottom-right",
  },
};

const categoryOrder = ["essays", "research", "writing", "project", "talk"];
const writingSlugs = new Set([
  "first-person-with-a-name",
  "philosophy-of-45-degrees-of-life",
  "iterated-prisoners-dilemma",
  "marriage-analysis",
  "time-travel-letter",
  "love-and-solitude",
  "software-engineering-farther-horizons",
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function normalizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function titleToEnglish(title) {
  return /[A-Za-z]/.test(title) && !/[\u4e00-\u9fff]/u.test(title) ? title : title;
}

function excerptForList(text) {
  const clean = normalizeText(text);
  if (clean.length <= 120) {
    return clean;
  }
  return `${clean.slice(0, 120).replace(/[，。、；：,.]+$/u, "")}...`;
}

function updatedAt() {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing works manifest: ${manifestPath}`);
  }

  const items = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return items
    .map((item) => ({
      ...item,
      excerpt: excerptForList(item.excerpt),
      href: `works/${item.slug}.html`,
      meta: item.imageCount > 0 ? `${item.year} / ${item.imageCount} images` : `${item.year} / text only`,
    }))
    .sort((left, right) => {
      const yearGap = Number(right.year) - Number(left.year);
      if (yearGap !== 0) {
        return yearGap;
      }
      return left.title.localeCompare(right.title, "zh-Hans-CN");
    });
}

function getSectionKey(item) {
  if (item.category === "essay") {
    return writingSlugs.has(item.slug) ? "writing" : "essays";
  }

  return item.category;
}

function buildData(items) {
  const sections = categoryOrder
    .map((sectionKey) => {
      const meta = categoryMeta[sectionKey];
      const links = items
        .filter((item) => getSectionKey(item) === sectionKey)
        .map((item) => ({
          title: titleToEnglish(item.title),
          originalTitle: item.title,
          href: item.href,
          domain: item.meta,
        }));

      if (links.length === 0) {
        return null;
      }

      return {
        id: meta.id.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: meta.title,
        originalTitle: meta.title,
        parent: "Selected Works",
        sectionKey,
        note: meta.note,
        span: meta.span,
        position: meta.position,
        count: links.length,
        links,
      };
    })
    .filter(Boolean);

  return {
    site: {
      title: "Knowledge Base",
      displayTitle: "Library",
      owner: "noahisarider",
      ownerUrl: "https://github.com/NoahIsARider",
      sourceFile: "word archive / sanitized import",
      updatedAt: updatedAt(),
    },
    stats: {
      totalLinks: items.length,
      totalSections: sections.length,
      totalBranches: sections.length,
    },
    sections,
  };
}

function renderTopNav(sections) {
  return sections
    .map((section) => `<a href="#${escapeAttribute(section.id)}">${escapeHtml(section.title)}</a>`)
    .join("\n");
}

function renderSection(section) {
  const links = section.links
    .map(
      (link) => `
        <li class="link-item">
          <a href="${escapeAttribute(link.href)}" title="${escapeAttribute(link.originalTitle)}">
            <span class="link-title">${escapeHtml(link.title)}</span>
            <span class="link-meta">${escapeHtml(link.domain)}</span>
          </a>
        </li>`,
    )
    .join("\n");

  return `
    <article class="section-block" id="${escapeAttribute(section.id)}" data-span="${escapeAttribute(section.span)}" data-position="${escapeAttribute(section.position)}">
      <div class="section-head">
        <h2>${escapeHtml(section.title)}</h2>
        <span class="section-count">${section.count} links</span>
      </div>
      <p class="section-parent">${escapeHtml(section.parent)}</p>
      <p class="section-note">${escapeHtml(section.note)}</p>
      <ul class="link-list">
        ${links}
      </ul>
    </article>`;
}

function renderHomePage(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>oblivion is freedom</title>
  <meta name="description" content="A reading wall of selected works adapted from source documents and published in the existing archive style.">
  <meta name="theme-color" content="#e7a1c4">
  <link rel="icon" type="image/png" href="${iconName}">
  <link rel="apple-touch-icon" href="${iconName}">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="page-shell">
    <header class="topbar" id="top">
      <a class="brand" href="${escapeAttribute(data.site.ownerUrl)}" target="_blank" rel="noreferrer">${escapeHtml(data.site.owner)}</a>
      <nav class="topnav" aria-label="Knowledge base sections">
        ${renderTopNav(data.sections)}
      </nav>
      <p class="topbar-status">${data.stats.totalLinks} works<br>${data.stats.totalSections} sections</p>
    </header>

    <section class="intro-grid" aria-label="Site introduction">
      <article class="intro-block">
        <h2>Index</h2>
        <p>A translated reading wall for selected works, rebuilt from original documents while preserving the archive layout.</p>
      </article>
      <article class="intro-block">
        <h2>Focus</h2>
        <p>Essays, research papers, project reports, and presentation drafts now sit inside the same editorial directory structure.</p>
      </article>
      <article class="intro-block">
        <h2>Source</h2>
        <p>Compiled from <span class="mono">${escapeHtml(data.site.sourceFile)}</span> and refreshed on ${escapeHtml(data.site.updatedAt)}.</p>
      </article>
      <article class="intro-block">
        <h2>Contact</h2>
        <p><a href="${escapeAttribute(data.site.ownerUrl)}" target="_blank" rel="noreferrer">GitHub / NoahIsARider</a><br><a href="https://codeberg.org/NoahIsARider" target="_blank" rel="noreferrer">Codeberg / NoahIsARider</a><br>Private archive, public doorway.</p>
      </article>
    </section>

    <section class="stage-mark" aria-hidden="true">
      <img class="stage-mark-image" src="${backgroundName}" alt="">
    </section>

    <section class="directory-grid" aria-label="Knowledge directory">
      ${data.sections.map(renderSection).join("\n")}
    </section>

    <footer class="footer">
      <p>Built for static deployment and action-based publishing.</p>
      <p><a href="#top">Back to top</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function relatedItems(current, items) {
  return items
    .filter((item) => getSectionKey(item) === getSectionKey(current) && item.slug !== current.slug)
    .slice(0, 4);
}

function readFragment(slug) {
  const fragmentPath = path.join(contentWorksDir, `${slug}.html`);
  if (!fs.existsSync(fragmentPath)) {
    throw new Error(`Missing work fragment: ${fragmentPath}`);
  }
  return fs.readFileSync(fragmentPath, "utf8").trim();
}

function renderWorkPage(item, items) {
  const fragment = readFragment(item.slug);
  const related = relatedItems(item, items);
  const relatedMarkup = related
    .map(
      (entry) => `
          <li class="link-item">
            <a href="${escapeAttribute(entry.slug)}.html" title="${escapeAttribute(entry.title)}">
              <span class="link-title">${escapeHtml(titleToEnglish(entry.title))}</span>
              <span class="link-meta">${escapeHtml(entry.year)}</span>
            </a>
          </li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(item.title)} | oblivion is freedom</title>
  <meta name="description" content="${escapeAttribute(excerptForList(item.excerpt))}">
  <meta name="theme-color" content="#e7a1c4">
  <link rel="icon" type="image/png" href="../${iconName}">
  <link rel="apple-touch-icon" href="../${iconName}">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <div class="page-shell work-page">
    <header class="topbar" id="top">
      <a class="brand" href="https://github.com/NoahIsARider" target="_blank" rel="noreferrer">noahisarider</a>
      <nav class="topnav" aria-label="Page navigation">
        <a href="../index.html">Archive</a>
        <a href="#article">Article</a>
      </nav>
      <p class="topbar-status">${escapeHtml(item.year)}<br>${item.imageCount > 0 ? `${item.imageCount} images` : "text only"}</p>
    </header>

    <section class="intro-grid" aria-label="Article overview">
      <article class="intro-block">
        <h2>Title</h2>
        <p>${escapeHtml(item.title)}</p>
      </article>
      <article class="intro-block">
        <h2>Section</h2>
        <p>${escapeHtml(categoryMeta[getSectionKey(item)]?.title || item.category)}</p>
      </article>
      <article class="intro-block">
        <h2>Summary</h2>
        <p>${escapeHtml(excerptForList(item.excerpt))}</p>
      </article>
      <article class="intro-block">
        <h2>Return</h2>
        <p><a href="../index.html">Back to the archive index</a><br>Read in the same static public edition.</p>
      </article>
    </section>

    <section class="stage-mark" aria-hidden="true">
      <img class="stage-mark-image" src="../${backgroundName}" alt="">
    </section>

    <section class="article-shell">
      <article class="article-body" id="article">
        <h1>${escapeHtml(item.title)}</h1>
        <p class="article-meta">${escapeHtml(item.year)} / ${escapeHtml(categoryMeta[getSectionKey(item)]?.title || item.category)}</p>
        <p class="article-summary">${escapeHtml(excerptForList(item.excerpt))}</p>
        <div class="article-content">
${fragment}
        </div>
      </article>
      <aside class="article-aside">
        <h2>Related</h2>
        <ul class="related-list">
${relatedMarkup || '          <li class="link-item"><span class="link-meta">No related items in this section yet.</span></li>'}
        </ul>
      </aside>
    </section>

    <footer class="footer">
      <p>Built for static deployment and action-based publishing.</p>
      <p><a href="../index.html">Back to archive</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function ensureInputs() {
  if (!fs.existsSync(stylesPath)) {
    throw new Error(`Missing styles file: ${stylesPath}`);
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing works manifest: ${manifestPath}`);
  }
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

function writeOutputs(homePage, json, items) {
  resetDir(distDir);
  resetDir(worksDir);

  writeFile(path.join(rootDir, "index.html"), homePage);
  writeFile(path.join(rootDir, "knowledge-base.json"), json);
  writeFile(path.join(distDir, "index.html"), homePage);
  writeFile(path.join(distDir, "knowledge-base.json"), json);

  fs.copyFileSync(stylesPath, path.join(distDir, "styles.css"));
  fs.copyFileSync(path.join(rootDir, iconName), path.join(distDir, iconName));
  fs.copyFileSync(path.join(rootDir, backgroundName), path.join(distDir, backgroundName));

  if (fs.existsSync(path.join(rootDir, "assets"))) {
    fs.cpSync(path.join(rootDir, "assets"), path.join(distDir, "assets"), {
      recursive: true,
      force: true,
    });
  }

  for (const item of items) {
    const page = renderWorkPage(item, items);
    writeFile(path.join(worksDir, `${item.slug}.html`), page);
    writeFile(path.join(distDir, "works", `${item.slug}.html`), page);
  }

  fs.writeFileSync(path.join(distDir, ".nojekyll"), "", "utf8");
}

function main() {
  ensureInputs();
  const items = readManifest();
  const data = buildData(items);
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const homePage = renderHomePage(data);
  writeOutputs(homePage, json, items);
  console.log(`Generated index.html, knowledge-base.json, and ${items.length} work pages with the existing archive layout.`);
}

main();
