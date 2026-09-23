const KEY = "becoming_stan_drafts";

const esc = s =>
  (s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

/* Fix image paths for GitHub Pages */
function fixImagePath(path) {
  if (!path) return "";

  path = path.trim();

  if (path.startsWith("/becoming-by-stan/")) {
    return path;
  }

  if (path.startsWith("/images/uploads/")) {
    return "/becoming-by-stan" + path;
  }

  if (path.startsWith("images/uploads/")) {
    return "/becoming-by-stan/" + path;
  }

  return path;
}

/* Get all published articles from GitHub */
async function getArticles() {
  let articles = [];

  try {
    const response = await fetch(
      "https://api.github.com/repos/becomingbystan/becoming-by-stan/contents/stories"
    );

    if (response.ok) {
      const files = await response.json();

      for (const file of files.filter(file =>
        file.name.toLowerCase().endsWith(".md")
      )) {
        try {
          const raw = await fetch(file.download_url).then(r => r.text());

          const article = parseMarkdownArticle(raw, file.name);

          if (article) {
            articles.push(article);
          }
        } catch (error) {
          console.error("Could not load article:", file.name, error);
        }
      }
    }
  } catch (error) {
    console.error("Could not connect to GitHub:", error);
  }

  /* Keep compatibility with any old local drafts */
  try {
    const localArticles = JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );

    articles.push(...localArticles);
  } catch (error) {
    console.error("Could not read local articles:", error);
  }

  /* Remove duplicates */
  const unique = [];
  const ids = new Set();

  for (const article of articles) {
    if (!ids.has(article.id)) {
      ids.add(article.id);
      unique.push(article);
    }
  }

  /* Newest first */
  unique.sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return unique;
}

/* Read a Markdown article */
function parseMarkdownArticle(raw, filename) {
  const match = raw.match(
    /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/
  );

  if (!match) {
    return null;
  }

  const frontmatter = match[1];
  const body = match[2].trim();

  function get(key) {
    const regex = new RegExp(
      "^" +
        key +
        "\\s*:\\s*[\"']?(.+?)[\"']?\\s*$",
      "mi"
    );

    const result = frontmatter.match(regex);

    return result
      ? result[1].trim()
      : "";
  }

  return {
    id: filename.replace(/\.md$/i, ""),
    title: get("title"),
    subtitle: get("subtitle"),
    category: get("category"),
    date: get("date"),
    image: fixImagePath(get("image")),
    excerpt: get("excerpt"),
    body: markdownToHtml(body)
  };
}

/* Convert the Markdown used by Sveltia into HTML */
function markdownToHtml(text) {
  if (!text) {
    return "";
  }

  let html = text;

  /*
    Images inserted inside the Article field
    become normal article images.
  */
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, src) => {
      const imageSrc = fixImagePath(src);

      return `
        <img
          class="article-image"
          src="${esc(imageSrc)}"
          alt="${esc(alt)}"
        >
      `;
    }
  );

  /* Headings */
  html = html
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>");

  /* Bold and italic */
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");

  /*
    Paragraphs:
    Two line breaks = new paragraph.
  */
  html = html
    .split(/\n\s*\n/)
    .map(block => {
      block = block.trim();

      if (!block) {
        return "";
      }

      /*
        Don't wrap standalone HTML images/headings
        inside a paragraph.
      */
      if (
        block.startsWith("<img") ||
        block.startsWith("<h1") ||
        block.startsWith("<h2") ||
        block.startsWith("<h3")
      ) {
        return block;
      }

      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return html;
}

/* Create an article card */
function card(article) {
  return `
    <a
      class="story-card"
      href="article.html?id=${encodeURIComponent(article.id)}"
    >

      <div
        class="image"
        ${
          article.image
            ? `style="background-image:url('${esc(article.image)}')"`
            : ""
        }
      ></div>

      <div class="meta">
        ${esc(article.category)} · ${esc(article.date)}
      </div>

      <h2>${esc(article.title)}</h2>

      ${
        article.excerpt
          ? `<p>${esc(article.excerpt)}</p>`
          : ""
      }

    </a>
  `;
}

/* Main site logic */
(async () => {
  const articles = await getArticles();

  /*
    HOME PAGE
  */
  const latest = document.querySelector("#latest");

  if (latest) {
    latest.innerHTML = articles
      .map(card)
      .join("");

    const count = document.querySelector("#count");

    if (count) {
      count.textContent =
        articles.length +
        (articles.length === 1
          ? " story"
          : " stories");
    }
  }

  /*
    CATEGORY PAGE
  */
  const categoryTitle =
    document.querySelector("#category-title");

  if (categoryTitle) {
    const category =
      new URLSearchParams(location.search).get("cat") ||
      "All stories";

    categoryTitle.textContent = category;

    const filtered =
      category === "All stories"
        ? articles
        : articles.filter(
            article =>
              article.category === category
          );

    const container =
      document.querySelector(
        "#category-stories"
      );

    if (container) {
      container.innerHTML =
        filtered.length
          ? filtered.map(card).join("")
          : "<p>No stories yet.</p>";
    }
  }

  /*
    ARTICLE PAGE
  */
  const articleTitle =
    document.querySelector("#article-title");

  if (articleTitle) {
    const id =
      new URLSearchParams(location.search).get(
        "id"
      );

    const article =
      articles.find(
        item => item.id === id
      );

    if (!article) {
      articleTitle.textContent =
        "Story not found";

      return;
    }

    document.title =
      article.title +
      " — Becoming, by Stan";

    const category =
      document.querySelector(
        "#article-category"
      );

    const subtitle =
      document.querySelector(
        "#article-subtitle"
      );

    const meta =
      document.querySelector(
        "#article-meta"
      );

    const body =
      document.querySelector(
        "#article-body"
      );

    if (category) {
      category.textContent =
        article.category;
    }

    articleTitle.textContent =
      article.title;

    if (subtitle) {
      subtitle.textContent =
        article.subtitle || "";
    }

    if (meta) {
      meta.textContent =
        article.date;
    }

    if (body) {
      /*
        IMPORTANT:
        The cover image is NOT inserted here.

        Only images manually inserted into
        the Sveltia Article field appear here.
      */
      body.innerHTML =
        article.body || "";
    }
  }
})();
