# Publishing dsh-tasks-panel

The plugin is already publish-ready: `npm pack --dry-run` ships 9 files and no
`node_modules`.

## One-time setup

1. Create an account at <https://www.npmjs.com/signup> (free).
2. Log in **against npmjs, not the local mirror** — this machine is configured with
   `registry=https://registry.npmmirror.com`, which is read-only:

   ```
   npm login --registry=https://registry.npmjs.org
   ```

## Every release

```
cd C:\Users\tortoise\Documents\deepseek-harness\default-workspace\dsh-tasks

# 1. bump "version" in package.json (edit the file, never with Set-Content)
# 2. check the two halves parse and the suites pass
node --check index.js
node --check client.js
node ..\.scratch\smoke-tasks.mjs
node ..\.scratch\notify-tasks.mjs
node ..\.scratch\render-tasks.mjs

# 3. look at exactly what will be uploaded (LICENSE, README, client.js, cordis.patch.yml,
#    icon.svg, index.js, locale/*.json, package.json — 9 files)
npm pack --dry-run

# 4. publish
npm publish --registry=https://registry.npmjs.org --access public
```

## If npm stages the release instead of publishing it

`npm publish` can come back looking successful while the registry only holds a
`0.0.0-stage` stub with the description "Temporary package placeholder for staged
publishing". That is npm's staged publishing: the upload landed in a staging area and
waits for a human with 2FA (<https://docs.npmjs.com/staged-publishing>). It happens
when the token may stage but not publish, or when the account requires 2FA for
publishing.

Approve it (needs the current npm 11 CLI, this machine ships npm 10):

```
npx npm@latest stage list dsh-tasks-panel
npx npm@latest stage approve <stage-id>     # prompts for the one-time code
```

or approve it on the package page on npmjs.com. Check with:

```
npm view dsh-tasks-panel version      # expect the version you published
```

## Verify

```
npm view dsh-tasks-panel version
```

Sanity-check the artifact the way a user receives it:

```
npm pack dsh-tasks-panel@<version> --registry=https://registry.npmjs.org
# unpack and compare index.js/client.js with this folder, then
npm install dsh-tasks-panel@<version> --registry=https://registry.npmjs.org
# and run the host smoke test against node_modules/dsh-tasks-panel/index.js
```

Then, in a fresh profile, install it the same way users will:

```
plugin_manager install_bundle target:"dsh-tasks-panel"
```

(the installer resolves the npm package name; the plugin appears as **Tasks** in
the sidebar.)

## Notes

- The npm name `dsh-tasks` is already taken by an unrelated 0.0.1 placeholder, which
  is why this package is `dsh-tasks-panel`.
- `zod` is a normal dependency: npm installs it. The `node_modules/zod` copy in this
  folder only exists because a `link:` install does not install dependencies.
- Renaming the package later means changing all four spots together:
  `package.json` `name`, `client.js` `__ModuleLoader__.load({ id })`, `index.js`
  `export const name`, and both `id`/`name` in `cordis.patch.yml`. The storage
  domain stays `dsh_tasks` either way, so task data survives a rename.
- After renaming, a running DSH keeps the old module id in memory until the app is
  restarted.
