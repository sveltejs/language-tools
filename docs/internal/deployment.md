### VS Code deployments

The [publisher is Svelte](https://marketplace.visualstudio.com/manage/publishers/svelte)

-   Extension builds with the account signed up via GitHub from orta

### npm deployments

-   Deployments come from a bot: `svelte-language-tools-deploy`

### When Deployments happen

-   Nightly builds are triggered through a scheduled GitHub workflow every night at 04:00 UTC.
-   Production builds are triggered by creating a new tag, which is best done through the "do a release" on Github. The tag name equals the version that is then shown on the marketplace, so each tag should have a higher version than the previous.
