# Suhyeong Park’s academic website

GitHub Pages publishes this site from the root of the `main` branch using its built-in Jekyll build. Home, Publications, and Blog share the layout in `_layouts/default.html`.

## Edit on the website

1. Click the `+` in the bottom-right corner and choose **New blog post** or **Add publication**.
2. Verify GitHub as `suhyeong10`. Use the link in the dialog to create a fine-grained personal access token for the `suhyeong10.github.io` repository with **Contents → Read and write**.
3. Enter the token in the dialog, fill in the editor, and publish. GitHub creates a commit on `main`, then Pages rebuilds the public site.

The editor holds the token in page memory. Blog drafts are saved in the browser. Published Markdown lives in `_posts/`. Entries added through the publication editor live in `_data/added_publications/`. The initial publications are in `_data/publications.yml`.

For local preview with Jekyll 3.10, run `jekyll serve` from the repository root.
