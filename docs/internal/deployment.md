### VS Code deployments

-   The [publisher is Svelte](https://marketplace.visualstudio.com/manage/publishers/svelte)
-   Extension builds with a personal access token [created through one of the members](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions) of that publisher which is added to [GitHub settings](https://github.com/sveltejs/language-tools/settings/secrets/actions)
-   Secret needs to be renewed once a year

### Open VSV deployments

-   The [publisher is Svelte](https://open-vsx.org/extension/svelte)
-   Extension builds with a personal access token [created through one of the members](https://github.com/eclipse/openvsx/blob/master/cli/README.md#publish-extensions) of that publisher which is added to [GitHub settings](https://github.com/sveltejs/language-tools/settings/secrets/actions)

### npm deployments

-   Deployments come from a bot: `svelte-language-tools-deploy` (an account some member have access to; it could also be done through other members of the language tools team)

### When Deployments happen

-   Nightly builds are triggered through a scheduled GitHub workflow every night at 04:00 UTC. (currently disabled, no plans on reenabling it)
-   Production builds are triggered by creating a new tag, which is best done through the "do a release" on Github. The tag name equals the version that is then shown on the marketplace, so each tag should have a higher version than the previous.
