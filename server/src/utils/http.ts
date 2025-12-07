/*
 * Utility function to extract JavaScript code from HTML content inside <script> tags.
 */
export function extractJSFromHTML(html: string): string {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gim;
  let match;
  const parts: string[] = [];

  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      parts.push(content);
    }
  }

  return parts.join("\n\n");
}
