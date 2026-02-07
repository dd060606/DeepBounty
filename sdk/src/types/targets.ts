export interface Target {
	id: number;
	name: string;
	domain: string;
	subdomains: string[];
	outOfScopeSubdomains: string[];
	packageNames: string[];
	activeScan: boolean;
	// Custom settings for the target
	settings?: {
		userAgent?: string;
		customHeader?: string;
	};
}
