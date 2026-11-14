import markdownIt from "./assets/blog/markdown-it.esm.min.js";

const markdown = markdownIt({ html: false });
const draftKey = "suhyeong10.blog-draft.v1";
const postPathPattern = /^(?:_posts\/\d{4}-\d{2}-\d{2}-|projects\/)[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:md|markdown)$/;
const maxImages = 6;
const maxImageCharacters = 2500000;
const researchOutline = "## Abstract\n\n\n\n## Problem\n\n\n\n## Method\n\n\n\n## Results\n\n\n\n## Analysis\n\n\n\n## Resources\n\n";
const postClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const renderImage = markdown.renderer.rules.image;
markdown.renderer.rules.image = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const url = token.attrGet("src");
  const draftImage = env?.draftImages?.get(url);
  if (draftImage) {
    env.usedImages.add(draftImage);
    if (env.preview) token.attrSet("src", `data:image/webp;base64,${draftImage.content}`);
  }
  return renderImage(tokens, index, options, env, renderer);
};

markdown.core.ruler.after("inline", "project_heading_ids", (state) => {
  if (!state.env?.project) return;
  for (let index = 0; index < state.tokens.length; index += 1) {
    const heading = state.tokens[index];
    if (heading.type !== "heading_open") continue;
    const lastText = state.tokens[index + 1]?.children?.at(-1);
    const match = lastText?.type === "text" && /\s*\{#([a-zA-Z][\w-]*)\}$/.exec(lastText.content);
    if (!match) continue;
    heading.attrSet("id", match[1]);
    lastText.content = lastText.content.slice(0, match.index);
  }
});

const postSource = document.getElementById("post-markdown");
const postContent = document.getElementById("post-content");
if (postSource && postContent) {
  postContent.innerHTML = markdown.render(postSource.value, { project: postSource.hasAttribute("data-project-markdown") });
}

const editorForm = document.getElementById("blog-form");
if (editorForm) setupEditor(editorForm);

function attachmentContext(images, showPreview = false) {
  return {
    draftImages: new Map(images.map((image) => [image.url, image])),
    usedImages: new Set(),
    preview: showPreview
  };
}

function validAttachment(image) {
  return /^assets\/uploads\/[a-zA-Z0-9_-]+\.webp$/.test(image?.path) &&
    image.url === "/" + image.path &&
    typeof image.content === "string" &&
    image.content.length <= maxImageCharacters &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(image.content);
}

function setupEditor(form) {
  const params = new URLSearchParams(location.search);
  const editPath = params.get("edit");
  const editing = params.has("edit");
  const projectPath = editPath?.startsWith("projects/");
  const storageKey = editing ? `${draftKey}:${editPath}` : draftKey;
  const destination = postDestination(params.get("return"));
  const title = document.getElementById("blog-editor-title");
  const loadStatus = document.querySelector("[data-blog-load-status]");
  const loadLatest = form.querySelector("[data-blog-load-latest]");
  const deleteArea = document.querySelector("[data-blog-delete-area]");
  const openDelete = deleteArea.querySelector("[data-blog-delete]");
  const deleteTitle = document.getElementById("blog-delete-title");
  const confirmation = deleteArea.querySelector("[data-blog-confirmation]");
  const confirmDelete = deleteArea.querySelector("[data-blog-confirm-delete]");
  const cancelDelete = deleteArea.querySelector("[data-blog-cancel-delete]");
  const deleteStatus = deleteArea.querySelector("[data-blog-delete-status]");
  const deletedMessage = document.querySelector("[data-blog-deleted]");
  const deletedTitle = deletedMessage.querySelector("h2");
  const titleField = form.elements.title;
  const sectionField = form.elements.section;
  const bodyField = form.elements.markdown;
  const fields = form.querySelector("[data-blog-fields]");
  const preview = form.querySelector("#blog-preview");
  const draftMessage = form.querySelector("[data-blog-draft]");
  const status = form.querySelector("[data-blog-status]");
  const postLink = form.querySelector("[data-blog-view]");
  const imageField = form.querySelector("#blog-image-upload");
  const altField = form.querySelector("#blog-image-alt");
  const attachButton = form.querySelector("[data-blog-attach]");
  const imageStatus = form.querySelector("[data-blog-image-status]");
  const outlineButton = form.querySelector("[data-blog-outline]");
  const publishButton = form.querySelector("[type=submit]");
  let publishing = false;
  let preparing = false;
  let updateTimer;
  let record;
  let loading = false;
  let conflicted = false;
  let deleted = false;
  let authGeneration = 0;
  let draft = { images: [] };

  if (editing) {
    updateLabels(projectPath ? "research" : "post");
    publishButton.textContent = "Save changes";
    form.hidden = true;
  } else {
    hydrateDraft(readDraft(storageKey) ?? draft);
  }

  function updateLabels(section) {
    const project = section === "research";
    const article = project ? "project article" : "post";
    title.textContent = `${editing ? "Edit" : "New"} ${project ? "research project" : "blog post"}`;
    document.title = `${title.textContent} · Suhyeong Park`;
    deleteTitle.textContent = openDelete.textContent = `Delete ${article}`;
    confirmation.querySelector("p").textContent = `Delete this published ${article} from the site? This removes its public page after the next build.`;
    deletedTitle.textContent = project ? "Project article deleted" : "Post deleted";
    deletedMessage.querySelector("p").textContent = `GitHub Pages will remove the ${article} in its next build.`;
  }

  function hydrateDraft(saved) {
    draft = saved;
    titleField.value = draft.title ?? "";
    bodyField.value = draft.body ?? "";
    sectionField.value = draft.section ?? record?.section ?? "post";
  }

  function setStatus(element, message, error = false) {
    element.textContent = message;
    element.classList.toggle("is-error", error);
  }

  function updatePreview() {
    const body = bodyField.value;
    if (!body.trim()) {
      preview.textContent = "Your formatted article will appear here.";
      return;
    }
    const project = record ? projectPath : sectionField.value === "research";
    preview.innerHTML = markdown.render(body, { ...attachmentContext(draft.images, true), project });
  }

  function saveDraft() {
    clearTimeout(updateTimer);
    if (deleted || (editing && !record)) return;
    const title = titleField.value;
    const body = bodyField.value;
    const section = sectionField.value;
    draft = { ...draft, title, body, section };
    try {
      const dirty = editing
        ? title !== record.title || body !== record.body || section !== record.section
        : title || body || section !== "post";
      if (dirty) {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        draftMessage.textContent = "Draft saved in this browser.";
      } else {
        localStorage.removeItem(storageKey);
        draftMessage.textContent = editing ? "" : "Drafts are saved in this browser.";
      }
    } catch {
      draftMessage.textContent = "The browser could not save this draft. Keep this page open to retain your work.";
    }
  }

  function updateEditor() {
    saveDraft();
    updatePreview();
    updateLabels(sectionField.value);
    outlineButton.hidden = Boolean(bodyField.value.trim());
  }

  function markConflict(message) {
    conflicted = true;
    publishButton.disabled = true;
    openDelete.disabled = true;
    loadLatest.hidden = false;
    setStatus(status, message, true);
  }

  function toggleConfirmation(open) {
    confirmation.hidden = !open;
    openDelete.hidden = open;
    (open ? cancelDelete : openDelete).focus();
  }

  async function loadRecord({ discardDraft = false } = {}) {
    if (loading || !window.siteAdmin?.isSignedIn()) return;
    if (!postPathPattern.test(editPath || "")) {
      setStatus(loadStatus, "This post link is invalid. Open it again from the Blog.", true);
      return;
    }

    loading = true;
    loadLatest.disabled = true;
    const generation = authGeneration;
    setStatus(loadStatus, "Loading published article…");
    try {
      const { contents, sha } = await window.siteAdmin.readEntry(editPath);
      if (generation !== authGeneration || !window.siteAdmin.isSignedIn()) return;
      const latest = parsePost(contents, editPath);
      const saved = discardDraft ? undefined : readDraft(storageKey);
      record = { ...latest, sha };
      hydrateDraft(saved ?? { title: record.title, body: record.body, baseSha: sha, images: [] });
      form.hidden = deleteArea.hidden = false;
      conflicted = false;
      publishButton.disabled = openDelete.disabled = false;
      loadLatest.hidden = true;
      setStatus(status, "");
      setStatus(loadStatus, "");
      updateEditor();
      if (saved && saved.baseSha !== sha) {
        markConflict("This post changed on GitHub since you started the draft. Copy your draft before loading the latest version.");
      }
    } catch (error) {
      setStatus(loadStatus, error?.message || "Could not load this post. Reload the page to try again.", true);
    } finally {
      loading = false;
      loadLatest.disabled = false;
      if (generation !== authGeneration && !record && window.siteAdmin.isSignedIn()) {
        void loadRecord();
      }
    }
  }

  if (editing) {
    window.addEventListener("site-admin-auth", (event) => {
      if (!event.detail.signedIn) {
        authGeneration += 1;
        if (!confirmation.hidden) {
          confirmation.hidden = true;
          openDelete.hidden = false;
        }
      } else if (!record && !deleted) {
        void loadRecord();
      }
    });
    if (window.siteAdmin?.isSignedIn()) void loadRecord();
  } else {
    updateEditor();
  }

  loadLatest.addEventListener("click", () => {
    if (publishing || preparing) return;
    void loadRecord({ discardDraft: true });
  });
  openDelete.addEventListener("click", () => {
    if (record && !publishing && !preparing && !conflicted) toggleConfirmation(true);
  });
  cancelDelete.addEventListener("click", () => toggleConfirmation(false));
  confirmDelete.addEventListener("click", async () => {
    if (!record || conflicted || publishing || preparing || !window.siteAdmin?.isSignedIn()) return;
    saveDraft();
    publishing = fields.disabled = confirmDelete.disabled = cancelDelete.disabled = true;
    setStatus(deleteStatus, "Deleting article…");
    try {
      const entryType = record.section === "research" ? "project article" : "blog post";
      await window.siteAdmin.deleteEntry(editPath, `Delete ${entryType}: ${record.title}`, record.sha);
      deleted = true;
      try { localStorage.removeItem(storageKey); } catch { /* Keep the deleted state visible. */ }
      form.hidden = deleteArea.hidden = true;
      deletedMessage.hidden = false;
      deletedMessage.focus();
    } catch (error) {
      setStatus(deleteStatus, error?.message || "Could not delete this post. Try again.", true);
      if (error?.status === 409) {
        toggleConfirmation(false);
        markConflict("The published post has changed. Load the latest version before trying again.");
      }
    } finally {
      publishing = fields.disabled = confirmDelete.disabled = cancelDelete.disabled = false;
    }
  });

  window.addEventListener("pagehide", saveDraft);

  form.addEventListener("input", (event) => {
    if (event.target !== titleField && event.target !== bodyField && event.target !== sectionField) return;
    event.target.setCustomValidity("");
    if (event.target === titleField && !editing) draft.createdAt = undefined;
    if (!conflicted) setStatus(status, "");
    postLink.hidden = true;
    if (event.target === sectionField) {
      updateEditor();
      return;
    }
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updateEditor, 180);
  });

  outlineButton.addEventListener("click", () => {
    if (bodyField.value.trim()) return;
    bodyField.value = researchOutline;
    bodyField.setCustomValidity("");
    bodyField.focus();
    const start = researchOutline.indexOf("\n\n") + 2;
    bodyField.setSelectionRange(start, start);
    updateEditor();
  });

  attachButton.addEventListener("click", async () => {
    if (preparing || publishing) return;
    const file = imageField.files[0];
    if (!file) {
      imageField.focus();
      setStatus(imageStatus, "Choose an image file first.", true);
      return;
    }
    if (!window.siteAdmin?.prepareImage) {
      setStatus(imageStatus, "Image upload is unavailable. Reload this page to try again.", true);
      return;
    }
    preparing = true;
    attachButton.disabled = publishButton.disabled = true;
    setStatus(imageStatus, "Preparing image…");
    try {
      const image = await window.siteAdmin.prepareImage(file);
      if (!validAttachment(image)) throw new Error("The image could not be prepared.");

      const context = attachmentContext(draft.images);
      markdown.render(bodyField.value, context);
      const referencedImages = [...context.usedImages];
      const totalSize = referencedImages.reduce((total, entry) => total + entry.content.length, image.content.length);
      if (referencedImages.length >= maxImages || totalSize > maxImageCharacters) {
        throw new Error("This draft allows up to 6 attached images and about 1.8 MB of prepared image data.");
      }

      const alt = (altField.value.trim() || file.name.replace(/\.[^.]+$/, "") || "Image")
        .replace(/[\r\n]/g, " ").replace(/[[\]\\]/g, "\\$&");
      const cursor = bodyField.selectionEnd;
      const before = cursor === 0 ? "" : "\n\n";
      const after = cursor === bodyField.value.length ? "\n" : "\n\n";
      const snippet = `${before}![${alt}](${image.url})${after}`;
      if (bodyField.value.length + snippet.length > bodyField.maxLength) {
        throw new Error("The draft is too long to insert another image.");
      }

      draft.images = [...referencedImages, image];
      bodyField.setRangeText(snippet, cursor, cursor, "end");
      bodyField.setCustomValidity("");
      imageField.value = altField.value = "";
      postLink.hidden = true;
      if (!conflicted) setStatus(status, "");
      setStatus(imageStatus, "Image inserted. Edit its description in Markdown.");
      bodyField.focus();
      updateEditor();
    } catch (error) {
      setStatus(imageStatus, error instanceof Error ? error.message : "Image insertion failed.", true);
    } finally {
      preparing = false;
      attachButton.disabled = false;
      publishButton.disabled = conflicted;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (publishing || preparing || conflicted || (editing && !record) ||
        !window.siteAdmin?.isSignedIn()) return;

    const title = titleField.value.trim();
    const body = bodyField.value;
    const section = sectionField.value;
    const entryType = section === "research" ? "project article" : "blog post";
    postLink.textContent = section === "research" ? "Open project" : "Open post";
    titleField.setCustomValidity(title ? "" : "Enter a title.");
    bodyField.setCustomValidity(body.trim() ? "" : "Write something for this article.");
    if (!form.reportValidity()) return;

    if (!window.siteAdmin?.createFile) {
      setStatus(status, "Publishing is unavailable. Reload this page to try again.", true);
      return;
    }

    if (!editing) draft.createdAt ??= Date.now();
    saveDraft();
    publishing = true;
    fields.disabled = true;
    setStatus(status, "Publishing…");

    try {
      const context = attachmentContext(draft.images);
      markdown.render(body, context);
      const images = [...context.usedImages];
      if (editing) {
        const contents = updatePost(record, title, body, section);
        const result = await window.siteAdmin.updateEntry(editPath, contents, `Update ${entryType}: ${title}`, images, record.sha);
        record = { ...parsePost(contents, editPath), sha: result.content.sha };
        hydrateDraft({ title: record.title, body: record.body, baseSha: record.sha, images: [] });
        updateEditor();
        setStatus(status, "Changes saved. GitHub Pages will update the article in its next build.");
        postLink.href = destination;
        postLink.hidden = false;
        postLink.focus();
        return;
      }
      const post = makePost(title, body, new Date(draft.createdAt), section);
      await window.siteAdmin.createFile(post.path, post.contents, `Publish ${entryType}: ${title}`, images);

      form.reset();
      draft = { images: [] };
      setStatus(imageStatus, "");
      updateEditor();
      setStatus(status, `${section === "research" ? "Project" : "Post"} committed. It will appear after GitHub Pages deploys it.`);
      postLink.href = post.url;
      postLink.hidden = false;
      postLink.focus();
    } catch (error) {
      setStatus(status, error instanceof Error ? error.message : "Publishing failed. Try again.", true);
      if (editing && (error?.status === 409 || error?.status === 404)) {
        markConflict("The published post has changed or is no longer available. Copy your draft before loading the latest version.");
      }
    } finally {
      fields.disabled = false;
      publishing = false;
    }
  });
}

function readDraft(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (typeof saved?.title === "string" && typeof saved.body === "string") {
      const createdAt = Number.isFinite(saved.createdAt) ? saved.createdAt : undefined;
      const images = Array.isArray(saved.images) ? saved.images.slice(0, maxImages).filter(validAttachment) : [];
      const baseSha = typeof saved.baseSha === "string" ? saved.baseSha : undefined;
      const section = saved.section === "research" || saved.section === "post" ? saved.section : undefined;
      return { title: saved.title, body: saved.body, section, createdAt, baseSha, images };
    }
  } catch {
    // The open editor can still retain the draft in memory.
  }
  return undefined;
}

function postDestination(value) {
  const blog = new URL("./blog/", import.meta.url);
  if (!value?.startsWith("/") || value.startsWith("//")) return blog;
  try {
    const destination = new URL(value, blog.origin);
    if (destination.origin === blog.origin) return destination;
  } catch {
    // A malformed return link leads back to the Blog.
  }
  return blog;
}

// The editor owns the title, blog section and Markdown body. Keep the
// other front matter (including the permalink, authors and date) as written.
function parsePost(contents, path) {
  const input = contents.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const frontMatter = /^---[ \t]*\n([\s\S]*?)^---[ \t]*(?:\n|$)/m.exec(input);
  if (!frontMatter || frontMatter.index !== 0) {
    throw new Error("This article needs Jekyll front matter before it can be edited here.");
  }
  const metadata = frontMatter[1].split("\n");
  const titleField = locateField(metadata, "title");
  const markdownField = locateField(metadata, "markdown");
  const sectionField = locateField(metadata, "blog_section");
  const titleFallback = path.split("/").at(-1).replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/\.(?:md|markdown)$/i, "").replace(/[-_]+/g, " ");
  const title = titleField ? readTitle(metadata, titleField) : titleFallback;
  const sectionValue = sectionField && readTitle(metadata, sectionField);
  const section = sectionValue === "research" || sectionValue === "post" ? sectionValue :
    path.startsWith("projects/") ? "research" : "post";
  const originalBody = input.slice(frontMatter[0].length);
  const body = markdownField ? readBlock(metadata, markdownField) : originalBody;
  return { title, body, section, metadata, titleField, markdownField, sectionField, originalBody, contents };
}

function locateField(lines, name) {
  const start = lines.findIndex((line) => line.startsWith(name + ":"));
  if (start < 0) return undefined;
  let end = start + 1;
  while (end < lines.length && (/^[ \t]+/.test(lines[end]) || lines[end] === "")) end += 1;
  while (end > start + 1 && lines[end - 1] === "") end -= 1;
  return { start, end, marker: lines[start].slice(name.length + 1).trim() };
}

function readTitle(lines, field) {
  const value = field.marker;
  if (value.startsWith('"')) {
    const quoted = value.match(/^"(?:[^"\\]|\\.)*"/)?.[0];
    if (quoted) {
      try { return JSON.parse(quoted); } catch { /* Support ordinary YAML quoting below. */ }
    }
  }
  if (value.startsWith("'")) {
    const quoted = value.match(/^'(?:[^']|'')*'/)?.[0];
    if (quoted) return quoted.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[|>]/.test(value)) return readBlock(lines, field).trim().replace(/\s+/g, " ");
  return value.replace(/[ \t]+#.*$/, "").trim();
}

function readBlock(lines, field) {
  if (!/^\|[1-9]?[+-]?(?:\s+#.*)?$/.test(field.marker)) {
    if (field.marker.startsWith(">")) {
      return lines.slice(field.start + 1, field.end).map((line) => line.trim()).join(" ");
    }
    throw new Error("This Markdown format cannot be opened in the editor.");
  }
  const block = lines.slice(field.start + 1, field.end);
  const spaces = Number(field.marker[1]) ||
    Math.min(...block.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length));
  return block.map((line) => line.slice(spaces)).join("\n").replace(/\n+$/, "");
}

function updatePost(record, title, body, section) {
  if (title === record.title && body === record.body && section === record.section) return record.contents;
  const output = [...record.metadata];
  const changes = [];
  if (title !== record.title) {
    const { start, end } = record.titleField ?? { start: 0, end: 0 };
    changes.push({ start, end, lines: [`title: ${encodeTitle(title)}`] });
  }
  if (record.markdownField && body !== record.body) {
    const { start, end } = record.markdownField;
    changes.push({ start, end, lines: ["markdown: |2-", ...markdownBlock(body)] });
  }
  if (section !== record.section) {
    const { start, end } = record.sectionField ?? { start: output.length, end: output.length };
    changes.push({ start, end, lines: [`blog_section: ${section}`] });
  }
  for (const change of changes.sort((left, right) => right.start - left.start)) {
    output.splice(change.start, change.end - change.start, ...change.lines);
  }
  while (output.at(-1) === "") output.pop();
  const postBody = record.markdownField ? record.originalBody : body.endsWith("\n") ? body : body + "\n";
  return ["---", ...output, "---", postBody].join("\n");
}

function markdownBlock(body) {
  return body.replace(/\r\n?/g, "\n").split("\n").map((line) => "  " + line);
}

function encodeTitle(title) {
  return JSON.stringify(title).replace(/[\u0085\u2028\u2029]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

function makePost(title, body, createdAt, section) {
  const parts = Object.fromEntries(postClock.formatToParts(createdAt).map(({ type, value }) => [type, value]));
  const { year, month, day, hour, minute, second } = parts;
  const date = `${year}-${month}-${day}`;
  const slug = slugify(title);
  const project = section === "research";
  const route = project ? `blog/projects/${slug}/` : `blog/${year}/${month}/${day}/${slug}/`;
  const contents = [
    "---",
    `title: ${encodeTitle(title)}`,
    `date: "${date} ${hour}:${minute}:${second} +0900"`,
    `slug: ${JSON.stringify(slug)}`,
    `blog_section: ${section}`,
    ...(project ? ["layout: project", `permalink: /${route}`, "project_card: true", `publication_date: "${date}"`] : []),
    "markdown: |2-",
    ...markdownBlock(body),
    "---",
    ""
  ].join("\n");
  return {
    path: project ? `projects/${slug}.md` : `_posts/${date}-${slug}.md`,
    contents,
    url: new URL(`./${route}`, import.meta.url)
  };
}

function slugify(title) {
  const slug = title.normalize("NFKD").toLowerCase().replace(/\p{Mark}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-").slice(0, 70).replace(/^-|-$/g, "");
  if (slug) return slug;

  // Keep filenames portable for titles that contain no Latin letters or digits.
  let hash = 2166136261;
  for (const character of title) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return `post-${(hash >>> 0).toString(36)}`;
}
