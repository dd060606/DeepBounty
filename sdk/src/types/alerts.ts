export interface Alert {
	id: number;
	name: string;
	targetName: string;
	domain: string;
	subdomain: string;
	score: number;
	confirmed: boolean;
	description: string;
	endpoint: string;
	createdAt: string;
}
