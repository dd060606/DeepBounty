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
  // Settings
  settings: ModuleSetting[];
};

export type ModuleSetting = {
  name: string;
  type: "checkbox" | "text" | "select" | "info";
  default: string | boolean;
  label: string;
  value: string | boolean;
  // Optional options for select-type settings
  options?: string[];
};
