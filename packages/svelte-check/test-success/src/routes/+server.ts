export async function GET({ url }) {
    return new Response(url.pathname);
}

export async function POST({ request }) {
    const body = await request.text();
    return new Response(body, { status: 201 });
}
