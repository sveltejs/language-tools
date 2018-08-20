const { AutoLanguageClient } = require('atom-languageclient')

class SvelteLanguageClient extends AutoLanguageClient {
  getGrammarScopes () { return ['source.svelte'] }
  getLanguageName () { return 'Svelte' }
  getServerName () { return 'Svelte Language Server' }
  getConnectionType() { return 'ipc' }

  startServerProcess () {
    return super.spawnChildNode([require.resolve('../../svelte-language-server/bin/server.js')], {
      stdio: [null, null, null, 'ipc']
    })
  }
}

module.exports = new SvelteLanguageClient()
