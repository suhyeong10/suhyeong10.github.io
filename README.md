# Suhyeong Park’s academic website

GitHub Pages publishes this site from the root of the `main` branch with Jekyll. Project pages under `projects/` share `_layouts/project.html`. Publication records in `_data/publications.yml` link representative figures in `assets/projects/` to their project pages.

## Edit on the website

1. Click the floating `+` and choose **New blog post** or **Add publication**.
2. Verify GitHub as `suhyeong10` with a fine-grained token for the `suhyeong10.github.io` repository with **Contents → Read and write**. The browser keeps the sign-in in the current tab across page changes and reloads. Use **Sign out of editor** in the `+` menu to clear it.
3. Fill in the editor and upload any images you want to publish. The site saves drafts in this browser and posts the page data and its images in one commit. GitHub Pages rebuilds after publication.

Published Markdown lives in `_posts/`. Publication entries added through the editor live in `_data/added_publications/`. Uploaded images live in `assets/uploads/`.

For local preview with Jekyll 3.10, run `jekyll serve` from the repository root.
