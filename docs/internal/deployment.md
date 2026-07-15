### VS Code deployments

-   The [publisher is Svelte](https://marketplace.visualstudio.com/manage/publishers/svelte)
-   Extension builds with a personal access token [created through one of the members](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions) of that publisher which is added to [GitHub settings](https://github.com/sveltejs/language-tools/settings/secrets/actions) (NOTE: this will change December 1st, PATs with global access scope are removed then by Microsoft)
-   Secret needs to be renewed once a year

### Open VSV deployments

-   The [publisher is Svelte](https://open-vsx.org/extension/svelte)
-   Extension builds with a personal access token [created through one of the members](https://github.com/eclipse/openvsx/blob/master/cli/README.md#publish-extensions) of that publisher which is added to [GitHub settings](https://github.com/sveltejs/language-tools/settings/secrets/actions)

### npm deployments

-   Deployments come from a bot: `svelte-language-tools-deploy` (an account some member have access to; it could also be done through other members of the language tools team)

### When/How Deployments happen

-   Everything except the VS Code extension is released as an npm package through changesets. Run `pnpm changeset` at the root after finishing the work and before opening a PR. Merging a PR will create a "Version packages" PR, merging it will release the packages. Some notes:
    -   `svelte2tsx`, `svelte-language-server` and `typescript-svelte-plugin` are treated as semi-public and therefore have major version 0. That means that even features should get a patch version, and breaking changes get a minor. No majors.
    -   `svelte-check` bundles `svelte2tsx` and `svelte-language-server`. Therefore, if you change something in one of those packages that affects `svelte-check`, you need to create a changeset for it, too
-   VS Code extension builds are triggered by creating a new tag, which is best done through the "do a release" on Github. The tag name is `extensions-<major.minor.patch>` and the part after the dash equals the version that is then shown on the marketplace, so each tag should have a higher version than the previous. After publishing a release with that tag through Github UI a workflow starts that deploys the extension
-   When deploying changes, FIRST merge the "Version packages" PR, then WAIT until it's done (+3 minutes, to give npm time to update its caches etc), and only THEN do the VS Code extension release. Reason is that the VS Code extension has the other packages in this repo as regular npm dependencies, so they need to be available there first.
