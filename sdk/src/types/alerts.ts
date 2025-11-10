export interface Alert {
	id: number;
	// Alert title
	name: string;
	// Associated target name
	targetName: string;
	// Target domain
	domain: string;
	// Affected subdomain
	subdomain: string;
	// Severity score (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)
	score: number;
	// Whether the vulnerability has been confirmed
	confirmed: boolean;
	// Detailed description of the alert
	description: string;
	// Specific endpoint/path where the vulnerability was found
	endpoint: string;
	createdAt: string;
}
