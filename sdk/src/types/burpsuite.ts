/**
 * HTTP traffic data from Burp Suite
 */
export interface HttpTraffic {
	url: string;
	method: string;
	statusCode: number;
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
	requestBody: string;
	responseBody: string;
	mimeType: string;
	timestamp: Date;
	targetId?: number;
}
