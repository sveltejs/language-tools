function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
	function create(info: ts.server.PluginCreateInfo) {
		// TODO
	}

	function getExternalFiles(project: ts.server.ConfiguredProject) {
		// TODO
	}

	return { create, getExternalFiles };
}

export = init;
