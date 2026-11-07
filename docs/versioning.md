# Versioning

ff-site's version (`MAJOR.MINOR.PATCH`) comes from git tags, not `package.json`, and
shows in the footer next to the API's. The scheme, how to bump minor/major with
`[minor]` / `[major]` in a PR (no marker: CI tags a patch, so every merge is one release), and how it's computed are documented once, in
`ff-server/docs/versioning.md`. ff-site differences:

- `next.config.ts` runs `git describe` at build time and inlines the result as
  `NEXT_PUBLIC_APP_VERSION` / `NEXT_PUBLIC_APP_COMMIT` (read by
  `src/components/footer/Footer.tsx`). With no git or no tags it shows `unknown`.
- The deploy builds in a temp git worktree, which sees the repo's tags; CI checks
  out with `fetch-depth: 0` so they exist.
- `src/lib/version.ts`'s `parseDescribe` mirrors `ff-server/src/utils/version.ts`:
  keep the two identical.
- This repo versions separately from ff-server. A feature spanning both needs the
  marker in both PRs.
