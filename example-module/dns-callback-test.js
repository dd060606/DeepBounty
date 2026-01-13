const dgram = require('dgram');

// --- CONFIGURATION ---
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 5300;
const BASE_DOMAIN = 'deepbounty.local';
const CALLBACK_UUID = "8572ae43-a9ec-44a5-a7cf-fef90807d315";

// --- DATA ---
const data = {
    message: "Hello from Localhost!",
    timestamp: Date.now()
};

// --- UTILITIES ---

const toHex = (str) => {
    return Array.from(str).map(c =>
        c.charCodeAt(0).toString(16).padStart(2, '0')
    ).join('');
};

/**
 * Manually builds a binary DNS Query Packet (Header + Question).
 */
const buildDnsQuery = (domain) => {
    // 1. Transaction ID (2 bytes) - Random
    const id = Buffer.alloc(2);
    id.writeUInt16BE(Math.floor(Math.random() * 65535));

    // 2. Flags (2 bytes) - Standard Query (0x0100)
    const flags = Buffer.from([0x01, 0x00]);

    // 3. Questions Count (2 bytes) - 1 Question
    const qCount = Buffer.from([0x00, 0x01]);

    // 4. Counts for Answer/Authority/Additional (6 bytes) - All 0
    const others = Buffer.alloc(6);

    // 5. Query Name (Variable length) - Encoded as [len][text] labels
    const parts = domain.split('.');
    let qNameParts = [];
    for (const part of parts) {
        const len = Buffer.from([part.length]);
        const val = Buffer.from(part);
        qNameParts.push(len, val);
    }
    qNameParts.push(Buffer.from([0x00])); // Null terminator for domain end
    const qName = Buffer.concat(qNameParts);

    // 6. Query Type (2 bytes) - A Record (0x0001)
    const qType = Buffer.from([0x00, 0x01]);

    // 7. Query Class (2 bytes) - IN (0x0001)
    const qClass = Buffer.from([0x00, 0x01]);

    // Combine all parts
    return Buffer.concat([id, flags, qCount, others, qName, qType, qClass]);
};

// --- MAIN LOGIC ---

// Strip hyphens
const cleanUuid = CALLBACK_UUID.replace(/-/g, '');

// Prepare Payload
const jsonStr = JSON.stringify(data);
const hexPayload = toHex(jsonStr);

// Chunking Logic
const CHUNK_SIZE = 50;
const chunks = hexPayload.match(new RegExp('.{1,' + CHUNK_SIZE + '}', 'g'));

if (chunks) {
    // Create a UDP socket
    const client = dgram.createSocket('udp4');

    chunks.forEach((chunk, index) => {
        // Construct hostname: [index]-[total].[uuid].[chunk].[base_domain]
        const total = chunks.length;
        const hostname = `${index}-${total}.${cleanUuid}.${chunk}.${BASE_DOMAIN}`;

        // Build the raw binary DNS packet
        const packet = buildDnsQuery(hostname);

        // Send UDP packet with jitter
        setTimeout(() => {
            client.send(packet, SERVER_PORT, SERVER_HOST, (err) => {
                // Close socket nicely after the last chunk is sent
                if (index === chunks.length - 1) {
                    setTimeout(() => client.close(), 500);
                }
            });
        }, index * 150);
    });
}