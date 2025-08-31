export type Target = {
  id: number;
  name: string;
  domain: string;
  subdomains: string[];
  activeScan: boolean;
  settings?: {
    userAgent?: string;
    headerName?: string;
    headerValue?: string;
  };
};
