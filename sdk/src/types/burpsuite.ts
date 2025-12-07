/**
 * HTTP traffic data from Burp Suite
 */
export interface TrafficContext {
	url: string;
	method: string;
	statusCode: number;
	mimeType: string;
}
export interface TrafficContent {
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
	requestBody: string;
	responseBody: string;
}

export interface HttpTraffic extends TrafficContext, TrafficContent {}
