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

export type Alert = {
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
};

// Modules

export type Module = {
  // Unique identifier
  id: string;
  // Human readable name
  name: string;
  // Version string
  version: string;
  // Short description
  description?: string;
};
