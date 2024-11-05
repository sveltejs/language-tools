<script>
	const config = { branding: { primaryColor: '#012345' } },
		branding = config?.branding;

	const cssString = `<style>:root {--primary-color: ${
		branding?.primaryColor ?? '#ABCDEF'
	};}</style>`;
</script>
