import markdownIt from "./assets/blog/markdown-it.esm.min.js";

const markdown = markdownIt({ html: false });
const draftKey = "suhyeong10.blog-draft.v1";
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

const postSource = document.getElementById("post-markdown");
const postContent = document.getElementById("post-content");
if (postSource && postContent) {
  postContent.innerHTML = markdown.render(postSource.value);
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
  const titleField = form.elements.title;
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
  let draft = readDraft() ?? { images: [] };

  titleField.value = draft.title ?? "";
  bodyField.value = draft.body ?? "";

  function setStatus(element, message, error = false) {
    element.textContent = message;
    element.classList.toggle("is-error", error);
  }

  function updatePreview() {
    const body = bodyField.value;
    if (!body.trim()) {
      preview.textContent = "Your formatted post will appear here.";
      return;
    }
    preview.innerHTML = markdown.render(body, attachmentContext(draft.images, true));
  }

  function saveDraft() {
    clearTimeout(updateTimer);
    const title = titleField.value;
    const body = bodyField.value;
    draft = { ...draft, title, body };
    try {
      if (title || body) {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        draftMessage.textContent = "Draft saved in this browser.";
      } else {
        localStorage.removeItem(draftKey);
        draftMessage.textContent = "Drafts are saved in this browser.";
      }
    } catch {
      draftMessage.textContent = "The browser could not save this draft. Keep this page open to retain your work.";
    }
  }

  function updateEditor() {
    saveDraft();
    updatePreview();
    outlineButton.hidden = Boolean(bodyField.value.trim());
  }

  updateEditor();
  window.addEventListener("pagehide", saveDraft);

  form.addEventListener("input", (event) => {
    if (event.target !== titleField && event.target !== bodyField) return;
    event.target.setCustomValidity("");
    if (event.target === titleField) draft.createdAt = undefined;
    setStatus(status, "");
    postLink.hidden = true;
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
      setStatus(status, "");
      setStatus(imageStatus, "Image inserted. Edit its description in Markdown.");
      bodyField.focus();
      updateEditor();
    } catch (error) {
      setStatus(imageStatus, error instanceof Error ? error.message : "Image insertion failed.", true);
    } finally {
      preparing = false;
      attachButton.disabled = publishButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (publishing || preparing) return;

    const title = titleField.value.trim();
    const body = bodyField.value;
    titleField.setCustomValidity(title ? "" : "Enter a title.");
    bodyField.setCustomValidity(body.trim() ? "" : "Write something for this post.");
    if (!form.reportValidity()) return;

    if (!window.siteAdmin?.createFile) {
      setStatus(status, "Publishing is unavailable. Reload this page to try again.", true);
      return;
    }

    draft.createdAt ??= Date.now();
    saveDraft();
    publishing = true;
    fields.disabled = true;
    setStatus(status, "Publishing…");

    try {
      const post = makePost(title, body, new Date(draft.createdAt));
      const context = attachmentContext(draft.images);
      markdown.render(body, context);
      await window.siteAdmin.createFile(post.path, post.contents, `Publish blog post: ${title}`, [...context.usedImages]);

      form.reset();
      draft = { images: [] };
      setStatus(imageStatus, "");
      updateEditor();
      setStatus(status, "Post committed. It will appear after GitHub Pages deploys it.");
      postLink.href = post.url;
      postLink.hidden = false;
      postLink.focus();
    } catch (error) {
      setStatus(status, error instanceof Error ? error.message : "Publishing failed. Try again.", true);
    } finally {
      fields.disabled = false;
      publishing = false;
    }
  });
}

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey));
    if (typeof saved?.title === "string" && typeof saved.body === "string") {
      const createdAt = Number.isFinite(saved.createdAt) ? saved.createdAt : undefined;
      const images = Array.isArray(saved.images) ? saved.images.slice(0, maxImages).filter(validAttachment) : [];
      return { title: saved.title, body: saved.body, createdAt, images };
    }
  } catch {
    // The open editor can still retain the draft in memory.
  }
  return undefined;
}

function makePost(title, body, createdAt) {
  const parts = Object.fromEntries(postClock.formatToParts(createdAt).map(({ type, value }) => [type, value]));
  const { year, month, day, hour, minute, second } = parts;
  const date = `${year}-${month}-${day}`;
  const slug = slugify(title);
  const markdownBlock = body.replace(/\r\n?/g, "\n").split("\n").map((line) => `  ${line}`).join("\n");
  const yamlTitle = JSON.stringify(title).replace(/[\u0085\u2028\u2029]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
  const contents = [
    "---",
    `title: ${yamlTitle}`,
    `date: "${date} ${hour}:${minute}:${second} +0900"`,
    `slug: ${JSON.stringify(slug)}`,
    "markdown: |2-",
    markdownBlock,
    "---",
    ""
  ].join("\n");
  return {
    path: `_posts/${date}-${slug}.md`,
    contents,
    url: new URL(`./blog/${year}/${month}/${day}/${slug}/`, import.meta.url)
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
