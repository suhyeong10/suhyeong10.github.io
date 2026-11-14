import markdownIt from "./assets/blog/markdown-it.esm.min.js";

const markdown = markdownIt({ html: false });
const postSource = document.getElementById("post-markdown");
const postContent = document.getElementById("post-content");

if (postSource && postContent) {
  postContent.innerHTML = markdown.render(postSource.value);
}

const editor = document.getElementById("blog-editor");
if (editor) {
  setupEditor(editor);
}

const draftKey = "suhyeong10.blog-draft.v1";
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

function setupEditor(dialog) {
  const form = dialog.querySelector("#blog-form");
  const titleField = form.elements.title;
  const bodyField = form.elements.markdown;
  const fields = form.querySelector("[data-blog-fields]");
  const preview = form.querySelector("#blog-preview");
  const draftMessage = form.querySelector("[data-blog-draft]");
  const status = form.querySelector("[data-blog-status]");
  const postLink = form.querySelector("[data-blog-view]");
  const close = dialog.querySelector("[data-blog-close]");
  let publishing = false;
  let previewTimer;
  let draft;

  function updatePreview() {
    const body = bodyField.value;
    preview.innerHTML = markdown.render(body);
    if (!body.trim()) {
      preview.textContent = "Your formatted post will appear here.";
    }
  }

  function saveDraft() {
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
      draftMessage.textContent = "Browser storage is unavailable. Keep this tab open to retain your draft.";
    }
  }

  window.addEventListener("open-blog-editor", () => {
    if (dialog.open) return;

    draft = readDraft() ?? draft ?? {};
    titleField.value = draft.title ?? "";
    bodyField.value = draft.body ?? "";
    titleField.setCustomValidity("");
    bodyField.setCustomValidity("");
    status.textContent = "";
    status.classList.remove("is-error");
    postLink.hidden = true;
    saveDraft();
    updatePreview();
    dialog.showModal();
  });

  form.addEventListener("input", (event) => {
    event.target.setCustomValidity("");
    if (event.target === titleField) draft.createdAt = undefined;
    status.textContent = "";
    status.classList.remove("is-error");
    postLink.hidden = true;
    saveDraft();
    if (event.target === bodyField) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 100);
    }
  });

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (publishing) event.preventDefault();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (publishing) return;

    const title = titleField.value.trim();
    const body = bodyField.value;
    titleField.setCustomValidity(title ? "" : "Enter a title.");
    bodyField.setCustomValidity(body.trim() ? "" : "Write something for this post.");
    if (!form.reportValidity()) return;

    if (!window.siteAdmin?.createFile) {
      status.textContent = "Publishing is unavailable. Reload this page to try again.";
      status.classList.add("is-error");
      return;
    }

    draft.createdAt ??= Date.now();
    saveDraft();
    publishing = true;
    fields.disabled = true;
    close.disabled = true;
    status.textContent = "Publishing…";
    status.classList.remove("is-error");

    try {
      const post = makePost(title, body, new Date(draft.createdAt));
      await window.siteAdmin.createFile(post.path, post.contents, `Publish blog post: ${title}`);

      form.reset();
      draft = {};
      saveDraft();
      updatePreview();
      status.textContent = "Post committed. It will appear after GitHub Pages deploys it.";
      postLink.href = post.url;
      postLink.hidden = false;
      postLink.focus();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Publishing failed. Try again.";
      status.classList.add("is-error");
    } finally {
      fields.disabled = false;
      close.disabled = false;
      publishing = false;
    }
  });
}

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey));
    if (typeof saved?.title === "string" && typeof saved.body === "string") {
      const createdAt = Number.isFinite(saved.createdAt) ? saved.createdAt : undefined;
      return { title: saved.title, body: saved.body, createdAt };
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
