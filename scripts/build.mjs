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
    position: "top-right",
  },
  research: {
    id: "research-and-analysis",
    title: "Research and Analysis",
    note: "Course-derived research pieces, market analysis, ethics writing, and applied investigations with sensitive context removed.",
    span: "wide",
    position: "top-left",
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

const categoryOrder = ["research", "essays", "writing", "project", "talk"];

const archiveCategoryMeta = {
  research: { label: "Research", short: "RSRCH" },
  essays: { label: "Essays", short: "ESSAY" },
  writing: { label: "Writing", short: "WRITE" },
  project: { label: "Projects", short: "PROJ" },
  talk: { label: "Talks", short: "TALK" },
};

function firstGlyph(title) {
  for (const ch of String(title)) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      return ch.toUpperCase();
    }
  }
  return "?";
}

function firstImageOf(item) {
  const fragmentPath = path.join(contentWorksDir, `${item.slug}.html`);
  if (!fs.existsSync(fragmentPath)) {
    return null;
  }
  const html = fs.readFileSync(fragmentPath, "utf8");
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) {
    return null;
  }
  const src = match[1].replace(/^\.\.\//, "");
  return src;
}
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

function imageCountLabel(count) {
  return count === 1 ? "1 image" : `${count} images`;
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
      meta: item.imageCount > 0 ? `${item.year} / ${imageCountLabel(item.imageCount)}` : `${item.year} / text only`,
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
  const explicitSection = typeof item.section === "string" ? item.section.trim().toLowerCase() : "";
  if (explicitSection && categoryMeta[explicitSection]) {
    return explicitSection;
  }

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
      <nav class="topnav" aria-label="Site sections">
        ${renderTopNav(data.sections)}
        <a class="nav-archive" href="portfolio/" title="Selected works portfolio">Portfolio</a>
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
      <p>Built for static deployment and action-based publishing.<br><a href="portfolio/">Portfolio</a> <3</p>
      <p><a href="#top">Back to top</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function coverImageFor(slug) {
  const coverPath = path.join(rootDir, "assets", "covers", `${slug}.jpg`);
  return fs.existsSync(coverPath) ? `assets/covers/${slug}.jpg` : null;
}

function renderMinimalArchive(items) {
  const entries = items
    .map((item) => {
      const sectionKey = getSectionKey(item);
      const meta = archiveCategoryMeta[sectionKey] || {
        label: item.category,
        short: String(item.category).toUpperCase(),
      };
      return {
        title: item.title,
        href: `../works/minimal/${item.slug}.html`,
        year: item.year,
        category: sectionKey,
        categoryLabel: meta.label,
        categoryShort: meta.short,
        medium: `${meta.label} / ${item.imageCount > 0 ? imageCountLabel(item.imageCount) : "text only"}`,
        glyph: firstGlyph(item.title),
        image: item.imageCount > 0 ? firstImageOf(item) : null,
        cover: coverImageFor(item.slug),
      };
    })
    .sort(
      (left, right) =>
        Number(right.year) - Number(left.year) ||
        left.title.localeCompare(right.title, "zh-Hans-CN"),
    );

  const dataJson = JSON.stringify(entries, null, 2);

  const catNav = [
    `<button type="button" class="cat-btn active" data-filter="all">All</button>`,
    ...categoryOrder
      .filter((key) => entries.some((entry) => entry.category === key))
      .map(
        (key) =>
          `<button type="button" class="cat-btn" data-filter="${escapeAttribute(key)}">${escapeHtml(archiveCategoryMeta[key].label)}</button>`,
      ),
  ].join("\n");

  const rows = entries
    .map((entry) => {
      const cover = entry.cover
        ? `<div class="work-cover">
            <img class="cover-img" src="${escapeAttribute("../" + entry.cover)}" alt="" loading="lazy">
          </div>`
        : `<div class="work-cover work-cover-text" aria-hidden="true">
            <span class="cover-cat">${escapeHtml(entry.categoryShort)}</span>
            <span class="cover-char">${escapeHtml(entry.glyph)}</span>
            <span class="cover-year">${escapeHtml(entry.year)}</span>
          </div>`;
      return `
        <li class="work-row" data-category="${escapeAttribute(entry.category)}">
          <div class="work-info">
            <h3 class="work-title"><a href="${escapeAttribute(entry.href)}">${escapeHtml(entry.title)}</a></h3>
            <p class="work-medium">${escapeHtml(entry.medium)}</p>
          </div>
          <span class="work-year">${escapeHtml(entry.year)}</span>
${cover}
        </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Selected Works | oblivion is freedom</title>
  <meta name="description" content="A quiet typographic archive of selected works — writing, research, and experiments.">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" type="image/png" href="../${iconName}">
  <link rel="apple-touch-icon" href="../${iconName}">
  <link rel="stylesheet" href="../minimal-archive.css">
</head>
<body>
  <div class="archive-shell">
    <header class="archive-topbar" id="top">
      <a class="brand" href="../index.html">oblivio</a>
      <p class="archive-status" id="work-count">${entries.length} works</p>
    </header>

    <div class="archive-grid">
      <aside class="archive-sidebar">
        <h2 class="artist-name">Noahisarider</h2>
        <nav class="cat-nav" aria-label="Filter works by category">
${catNav}
        </nav>
        <div class="sidebar-links">
          <a href="https://github.com/NoahIsARider" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://codeberg.org/NoahIsARider" target="_blank" rel="noreferrer">Codeberg</a>
        </div>
      </aside>

      <main class="archive-main">
        <ul class="work-list">
${rows}
        </ul>
      </main>
    </div>

    <footer class="archive-footer">
      <p>Built for static deployment and action-based publishing.</p>
      <p><a href="../index.html">Archive index</a> · <a href="../ember-archive.html">Amber</a> · <a href="#top">Back to top</a></p>
    </footer>
  </div>

  <script>
  (function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".work-row"));
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".cat-btn"));
    var count = document.getElementById("work-count");
    var total = rows.length;

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        buttons.forEach(function (other) {
          other.classList.remove("active");
        });
        button.classList.add("active");
        var filter = button.getAttribute("data-filter");
        var visible = 0;
        rows.forEach(function (row) {
          var show = filter === "all" || row.getAttribute("data-category") === filter;
          row.style.display = show ? "" : "none";
          if (show) {
            visible += 1;
          }
        });
        if (count) {
          count.textContent = visible + " / " + total + " works";
        }
      });
    });
  })();
  </script>
</body>
</html>`;
}


const ASCII_ORGANISM = String.raw`
        .  .  .     .  .
     .  *     .  *     .
   .     o        o     .
  .        '  .  '        .
   .     o        o     .
     .  *     .  *     .
        .  .  .     .  .`;

function renderEmberArchive(items) {
  const entries = items
    .map((item) => {
      const sectionKey = getSectionKey(item);
      const meta = archiveCategoryMeta[sectionKey] || { label: item.category, short: String(item.category).toUpperCase() };
      return {
        title: item.title,
        href: `works/ember/${item.slug}.html`,
        year: item.year,
        categoryLabel: meta.label,
      };
    })
    .sort((l, r) => Number(r.year) - Number(l.year) || l.title.localeCompare(r.title, "zh-Hans-CN"));

  const rows = entries
    .map((entry, i) => `
        <a class="ember-row" href="${escapeAttribute(entry.href)}" tabindex="0">
          <span class="c-no">${String(i + 1).padStart(3, "0")}</span>
          <span class="c-title">${escapeHtml(entry.title)}</span>
          <span class="c-cat">${escapeHtml(entry.categoryLabel)}</span>
          <span class="c-year">${escapeHtml(entry.year)}</span>
        </a>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amber | oblivion is freedom</title>
  <meta name="description" content="An amber CRT terminal merged with computational vision — halftone fields, particle networks and a phosphor index of the selected works.">
  <meta name="theme-color" content="#0b0703">
  <link rel="icon" type="image/png" href="${iconName}">
  <link rel="apple-touch-icon" href="${iconName}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=VT323&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="ember-archive.css">
</head>
<body>
  <div class="crt" aria-hidden="true"></div>

  <div class="ember-shell">
    <div class="ember-window">
      <div class="ember-titlebar">
        <span class="win-title">oblivio — ember.sys</span>
        <span class="win-dots">─ □ ✕</span>
      </div>

      <div class="ember-body">
        <div class="ember-menu mono">
          <span class="menu-item active">ARCHIVE</span>
          <span class="menu-item">VIEW</span>
          <span class="menu-item">HELP</span>
          <span class="menu-spacer"></span>
          <span class="menu-item" id="menu-clock">00:00:00</span>
        </div>

        <div class="ember-table mono" role="list">
          <div class="ember-thead">
            <span>NO.</span><span>TITLE</span><span>CATEGORY</span><span>YEAR</span>
          </div>
${rows}
        </div>

        <div class="ember-statusbar mono">
          <span>OBLIVIO // AMBER.SYS</span>
          <span>${String(entries.length).padStart(3, "0")} WORKS INDEXED</span>
          <span class="live" id="status-clock">SYS 00:00:00</span>
        </div>

        <div class="ember-prompt mono">
          <span class="ps1">oblivio@archive:~$</span> <span class="cmd">cat archive --view=ember --sort=year</span><span class="cursor-block"></span>
        </div>

        <footer class="ember-footer">
          <div class="dot-band" aria-hidden="true"></div>
          <div class="foot-meta mono">
            <span>PRIVATE ARCHIVE · PUBLIC DOORWAY</span>
            <span><a href="index.html">INDEX</a> · <a href="portfolio/">PORTFOLIO</a></span>
          </div>
          <div class="ascii-panel" aria-hidden="true"><pre>${ASCII_ORGANISM.trim()}</pre></div>
        </footer>
      </div>
    </div>
  </div>

  <script>
  (function () {

    // clocks
    var menuClock = document.getElementById("menu-clock");
    var statusClock = document.getElementById("status-clock");
    function clock() {
      var d = new Date();
      var p = function (n) { return String(n).padStart(2, "0"); };
      var t = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
      menuClock.textContent = t;
      statusClock.textContent = "SYS " + t;
    }
    clock();
    setInterval(clock, 1000);

  })();
  </script>
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

// Source fragments reference images as `../assets/...` (correct for pink pages
// at works/<slug>.html, one level below root). The themed pages live one level
// deeper (works/minimal|ember/<slug>.html) and need an extra `../`.
function fragmentForDepth(fragment, depth) {
  const extra = "../".repeat(depth - 1);
  return fragment.replace(/src="\.\.\/assets\//g, `src="${extra}../assets/`);
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
      <p class="topbar-status">${escapeHtml(item.year)}<br>${item.imageCount > 0 ? imageCountLabel(item.imageCount) : "text only"}</p>
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
      <p>Built for static deployment and action-based publishing.<br><a href="../portfolio/">Portfolio</a> <3</p>
      <p><a href="../index.html">Back to archive</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function renderWorkPageMinimal(item, items) {
  const fragment = readFragment(item.slug);
  const related = relatedItems(item, items);
  const relatedMarkup = related
    .map(
      (entry) => `
          <li class="related-item">
            <a href="${escapeAttribute(entry.slug)}.html" title="${escapeAttribute(entry.title)}">
              <span class="related-title">${escapeHtml(titleToEnglish(entry.title))}</span>
              <span class="related-meta">${escapeHtml(entry.year)}</span>
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
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" type="image/png" href="../../${iconName}">
  <link rel="apple-touch-icon" href="../../${iconName}">
  <link rel="stylesheet" href="../../minimal-archive.css">
</head>
<body>
  <div class="archive-shell work-page-shell">
    <header class="archive-topbar" id="top">
      <a class="brand" href="../../portfolio/">oblivio</a>
      <p class="archive-status">${escapeHtml(item.year)} &middot; ${escapeHtml(categoryMeta[getSectionKey(item)]?.title || item.category)}</p>
    </header>

    <div class="work-header">
      <p class="work-header-section">${escapeHtml(categoryMeta[getSectionKey(item)]?.title || item.category)}</p>
      <h1 class="work-header-title">${escapeHtml(item.title)}</h1>
      <p class="work-header-summary">${escapeHtml(excerptForList(item.excerpt))}</p>
      <p class="work-header-meta">${escapeHtml(item.year)} / ${imageCountLabel(item.imageCount) || "text only"}</p>
    </div>

    <div class="work-content-layout">
      <article class="work-content-body">
        <div class="work-content">
${fragmentForDepth(fragment, 2)}
        </div>
      </article>
      <aside class="work-sidebar">
        <div class="work-sidebar-inner">
          <p class="sidebar-label">Return</p>
          <p class="sidebar-link"><a href="../../portfolio/">Back to portfolio</a></p>
          <p class="sidebar-label">Also available</p>
          <p class="sidebar-link"><a href="../../index.html">Archive index</a> &middot; <a href="../../ember-archive.html">Amber</a></p>
          <div class="sidebar-related">
            <p class="sidebar-label">Related</p>
            <ul class="related-list">
${relatedMarkup || '              <li class="related-item"><span class="related-meta">No related items in this section.</span></li>'}
            </ul>
          </div>
        </div>
      </aside>
    </div>

    <footer class="archive-footer">
      <p>Built for static deployment and action-based publishing.</p>
      <p><a href="../../index.html">Archive index</a> &middot; <a href="../../portfolio/">Portfolio</a> &middot; <a href="../../ember-archive.html">Amber</a> &middot; <a href="#top">Back to top</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function renderWorkPageEmber(item, items) {
  const fragment = readFragment(item.slug);
  const related = relatedItems(item, items);
  const relatedMarkup = related
    .map(
      (entry) => `
          <a class="ember-related-row" href="${escapeAttribute(entry.slug)}.html" tabindex="0">
            <span class="c-no">${String(related.indexOf(entry) + 1).padStart(3, "0")}</span>
            <span class="c-title">${escapeHtml(titleToEnglish(entry.title))}</span>
            <span class="c-year">${escapeHtml(entry.year)}</span>
          </a>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(item.title)} | ember | oblivion is freedom</title>
  <meta name="description" content="${escapeAttribute(excerptForList(item.excerpt))}">
  <meta name="theme-color" content="#0b0703">
  <link rel="icon" type="image/png" href="../../${iconName}">
  <link rel="apple-touch-icon" href="../../${iconName}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=VT323&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../ember-archive.css">
</head>
<body>
  <div class="crt" aria-hidden="true"></div>

  <div class="ember-shell ember-work-shell">
    <div class="ember-window">
      <div class="ember-titlebar">
        <span class="win-title">oblivio — reader.sys — ${escapeHtml(item.slug)}</span>
        <span class="win-dots">─ □ ✕</span>
      </div>

      <div class="ember-body">
        <div class="ember-work-header">
          <p class="ember-work-kicker">READING // ${escapeHtml(categoryMeta[getSectionKey(item)]?.title || item.category).toUpperCase()}</p>
          <h1 class="ember-work-title">${escapeHtml(item.title)}</h1>
          <p class="ember-work-meta">${escapeHtml(item.year)} &middot; ${item.imageCount > 0 ? imageCountLabel(item.imageCount) : "text only"}</p>
          <p class="ember-work-summary">${escapeHtml(excerptForList(item.excerpt))}</p>
        </div>

        <div class="ember-work-nav mono">
          <span class="menu-item active">READ</span>
          <span class="menu-item"><a href="../../ember-archive.html">INDEX</a></span>
          <span class="menu-spacer"></span>
          <span class="menu-item"><a href="../../index.html">PINK</a></span>
          <span class="menu-item"><a href="../../portfolio/">PORTFOLIO</a></span>
        </div>

        <div class="ember-work-layout">
          <article class="ember-work-content">
${fragmentForDepth(fragment, 2)}
          </article>
          <aside class="ember-work-sidebar">
            <div class="ember-work-related">
              <p class="ember-related-label mono">// RELATED ENTRIES</p>
              <div class="ember-related-list mono">
${relatedMarkup || '                <span class="c-title" style="color:var(--amber-dim)">No related entries found.</span>'}
              </div>
            </div>
          </aside>
        </div>

        <div class="ember-prompt mono">
          <span class="ps1">oblivio@reader:~$</span> <span class="cmd">cat ${escapeHtml(item.slug)} --view=reader</span><span class="cursor-block"></span>
        </div>

        <footer class="ember-footer">
          <div class="dot-band" aria-hidden="true"></div>
          <div class="foot-meta mono">
            <span>PRIVATE ARCHIVE · PUBLIC DOORWAY</span>
            <span><a href="../../index.html">INDEX</a> · <a href="../../portfolio/">PORTFOLIO</a> · <a href="../../ember-archive.html">AMBER</a></span>
          </div>
        </footer>
      </div>
    </div>
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

function renderRedirectStub(href, label) {
  const target = href;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Selected Works | oblivion is freedom</title>
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${target}">
  <script>location.replace("${target}");</script>
</head>
<body style="margin:0;padding:2rem 2.4rem;background:#fff;color:#111;font-family:Georgia,'Times New Roman',serif;">
  <p>This page has moved to <a href="${target}">${label}</a>.</p>
</body>
</html>`;
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

  const portfolioArchive = renderMinimalArchive(items);
  writeFile(path.join(rootDir, "portfolio", "index.html"), portfolioArchive);
  writeFile(path.join(distDir, "portfolio", "index.html"), portfolioArchive);
  // legacy URLs redirect to the canonical portfolio path
  const oldFileStub = renderRedirectStub("portfolio/", "portfolio/");
  writeFile(path.join(rootDir, "minimal-archive.html"), oldFileStub);
  writeFile(path.join(distDir, "minimal-archive.html"), oldFileStub);
  const oldFolderStub = renderRedirectStub("../portfolio/", "portfolio/");
  writeFile(path.join(rootDir, "minimal-archive", "index.html"), oldFolderStub);
  writeFile(path.join(distDir, "minimal-archive", "index.html"), oldFolderStub);

  const emberArchive = renderEmberArchive(items);
  writeFile(path.join(rootDir, "ember-archive.html"), emberArchive);
  writeFile(path.join(distDir, "ember-archive.html"), emberArchive);


  fs.copyFileSync(stylesPath, path.join(distDir, "styles.css"));
  fs.copyFileSync(path.join(rootDir, "minimal-archive.css"), path.join(distDir, "minimal-archive.css"));
  fs.copyFileSync(path.join(rootDir, "ember-archive.css"), path.join(distDir, "ember-archive.css"));
  fs.copyFileSync(path.join(rootDir, iconName), path.join(distDir, iconName));
  fs.copyFileSync(path.join(rootDir, backgroundName), path.join(distDir, backgroundName));

  if (fs.existsSync(path.join(rootDir, "assets"))) {
    fs.cpSync(path.join(rootDir, "assets"), path.join(distDir, "assets"), {
      recursive: true,
      force: true,
    });
  }

  const minimalWorksDir = path.join(worksDir, "minimal");
  const emberWorksDir = path.join(worksDir, "ember");
  const distMinimalWorksDir = path.join(distDir, "works", "minimal");
  const distEmberWorksDir = path.join(distDir, "works", "ember");

  for (const item of items) {
    const pinkPage = renderWorkPage(item, items);
    writeFile(path.join(worksDir, `${item.slug}.html`), pinkPage);
    writeFile(path.join(distDir, "works", `${item.slug}.html`), pinkPage);

    const minimalPage = renderWorkPageMinimal(item, items);
    writeFile(path.join(minimalWorksDir, `${item.slug}.html`), minimalPage);
    writeFile(path.join(distMinimalWorksDir, `${item.slug}.html`), minimalPage);

    const emberPage = renderWorkPageEmber(item, items);
    writeFile(path.join(emberWorksDir, `${item.slug}.html`), emberPage);
    writeFile(path.join(distEmberWorksDir, `${item.slug}.html`), emberPage);
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
  console.log(`Generated index.html, knowledge-base.json, portfolio/index.html, ember-archive.html, and ${items.length} work pages (pink / minimal / ember).`);
}

main();
