
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url, body } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json({ error: `Webhook failed: ${response.status} ${text}` }, { status: response.status });
        }

        // Discord typically returns 204 No Content
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
