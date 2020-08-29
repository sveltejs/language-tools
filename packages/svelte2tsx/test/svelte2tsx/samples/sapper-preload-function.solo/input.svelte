<script context="module">
	export async function preload(page, session) {
		const res = await this.fetch(`blog/${slug}.json`);
        this.error(500, 'OUCH');
        return await this.redirect(404, 'notfound');
	}
</script>