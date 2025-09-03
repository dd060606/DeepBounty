export type Target = {
  id: number;
  name: string;
  domain: string;
  subdomains: string[];
  activeScan: boolean;
  settings?: {
    userAgent?: string;
    customHeader?: string;
  };
};

// Alerts
export type SeverityScore = "informational" | "low" | "medium" | "high" | "critical";

export type Alert = {
  id: number;
  name: string;
  targetName: string;
  domain: string;
  subdomain: string;
  score: SeverityScore;
  confirmed: boolean;
  description: string;
  path: string;
  createdAt: string;
};
