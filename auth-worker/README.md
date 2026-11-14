# Website GitHub sign-in

This Cloudflare Worker handles GitHub App OAuth for `suhyeong10.github.io`. It verifies the owner by GitHub account ID and can create blog posts and publication records on `main`.

## Deploy

1. From this directory, run `npx wrangler login` and `npx wrangler deploy`. Note the HTTPS origin Wrangler prints.
2. In GitHub **Settings → Developer settings → GitHub Apps**, create a private GitHub App on the `suhyeong10` account. Enter `https://suhyeong10.github.io` as the homepage and the Worker origin followed by `/callback` as the callback URL. Disable webhooks, keep user access token expiration enabled, and grant **Repository permissions → Contents → Read and write**. GitHub adds Metadata read permission automatically.
3. Install the app with **Only select repositories** and select `suhyeong10.github.io`. Copy the app’s Client ID and generate a Client Secret.
4. Set the following Worker secrets. Paste the values into the interactive Wrangler prompts.

   ```sh
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put SESSION_KEY
   ```

   Generate the session key as 32 random bytes in base64url format, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.

5. Set `github_auth_origin` in the website’s `_config.yml` to the Worker’s HTTPS origin without a trailing slash or path. Deploy the Pages change, verify that the owner can sign in from the floating + button, and confirm that publishing a real entry triggers a GitHub Pages rebuild.

See [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [GitHub App user tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), and [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Website integration

- `GET /login?return=/blog/&action=blog&flow=<random-id>` starts sign-in. The action is either `blog` or `publication`. Store the random flow ID in the current tab before leaving for GitHub.
- After successful owner verification, the Worker redirects to that page with `#site-auth=<session>&action=<action>&flow=<random-id>`. A failure sends `#site-auth-error=<code>&flow=<random-id>`. The frontend should consume the fragment, match the remembered flow ID, and immediately remove the fragment from browser history.
- `GET /session` validates the opaque session and returns the owner's login. `POST /publish` accepts `{ path, contents, message }`. Both requests use `Authorization: Bearer <session>`. The API allows requests from the website origin only.
- The opaque session expires after an hour. The browser receives an encrypted session, and the Worker decrypts the GitHub token when publishing. A different worker secret invalidates all existing sessions.
