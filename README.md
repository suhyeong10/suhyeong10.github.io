# Suhyeong Park’s academic website

GitHub Pages publishes this site from the root of the `main` branch with Jekyll. Project pages under `projects/` share `_layouts/project.html`. Publication records link representative figures in `assets/projects/` to their project pages.

## Edit on the website

1. Click the floating `+` and choose **New blog post**, **Add publication**, or **Add update**.
2. Verify GitHub as `suhyeong10` with a fine-grained token for the `suhyeong10.github.io` repository with **Contents → Read and write**. The browser keeps the sign-in in the current tab across page changes and reloads. Use **Sign out of editor** in the `+` menu to clear it.
3. Fill in the editor and upload any images you want to publish. The site saves drafts in this browser and posts the page data and its images in one commit. GitHub Pages rebuilds after publication.

To change an existing entry, use **Edit** beside a post or local project on Blog, a paper in Publications, or a news item under Recently on Home. The editor can save edits or delete that entry after confirmation. Deleting an entry removes its page or listing after GitHub Pages rebuilds. Attached images remain in the repository for other pages that may still use them.

Published Markdown lives in `_posts/`. Publication entries live in `_data/added_publications/`. Recently entries live in `_data/updates/`. Uploaded images live in `assets/uploads/`.

The CV uses `_data/cv.json`. On the CV page, verify the same GitHub token if needed and use the pencil to reveal section and entry controls. CV publications are maintained separately from the main Publications listing. **Export PDF** downloads a PDF generated in the browser from the current published CV.

For local preview with Jekyll 3.10, run `jekyll serve` from the repository root.
