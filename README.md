# Suhyeong Park’s academic website

GitHub Pages publishes this site from the root of the `main` branch using its built-in Jekyll build. Home, Publications, and Blog share the layout in `_layouts/default.html`.

## Research projects

Project pages under `projects/` are listed on the Blog and share `_layouts/project.html`. Publication records in `_data/publications.yml` link their thumbnail to the internal or external project page. Figures live under `assets/projects/`.

## Edit on the website

When GitHub OAuth is configured, the floating `+` prompts the owner to sign in with GitHub and then opens the editor menu. Follow the [OAuth setup guide](auth-worker/README.md) to register the GitHub App, deploy the authentication Worker, and set `github_auth_origin`.

Until the Worker origin is configured, the editor uses the existing fine-grained token flow.

1. Click the `+` in the bottom-right corner and choose **New blog post** or **Add publication**.
2. Verify GitHub as `suhyeong10`. Use the link in the dialog to create a fine-grained personal access token for the `suhyeong10.github.io` repository with **Contents → Read and write**.
3. Enter the token in the dialog, fill in the editor, and publish. GitHub creates a commit on `main`, then Pages rebuilds the public site.

The editor holds the token in page memory. Blog drafts are saved in the browser. Published Markdown lives in `_posts/`. Entries added through the publication editor live in `_data/added_publications/`. The initial publications are in `_data/publications.yml`.

For local preview with Jekyll 3.10, run `jekyll serve` from the repository root.
