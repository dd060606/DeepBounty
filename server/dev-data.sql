INSERT INTO public.targets (id, name,"domain","activeScan","createdAt") VALUES
	 (1, 'Google','google.com',true,'2025-08-29 10:31:02.819995'),
	 (2, 'Teamviewer','teamviewer.com',false,'2025-08-29 10:31:24.236022');

INSERT INTO public.targets_subdomains ("targetId",subdomain) values
     (1,'*.google.com'),
	 (2,'login.teamviewer.com'),
	 (2,'teamviewer.com');

INSERT INTO public.alerts ("targetId",name,subdomain,score,confirmed,description,endpoint,"createdAt") VALUES
	 (1,'SSRF','auth.google.com',4,false,'A SSRF Is available at 
<code>https://google.com?path=TRAVERSAL</code>','/home/path?=aa.com','2025-09-07 10:29:46.458289'),
	 (2,'NPM Dependency Confusion','test.domain.com',3,true,'A Dependency Confusion vulnerability is found: 
<code>{
''host'':''domain.com'',
''file'':''test.png''
}
Test</code>','/home/main.js?v=1.1.6','2025-09-07 10:53:08.780525'),
	 (1,'SQL Injection','api.google.com',4,true,'SQL Injection vulnerability found in search parameter. Payload: <code>'' OR 1=1--</code>','/api/v1/search?q=test','2025-11-15 14:23:10.123456'),
	 (1,'XSS Reflected','mail.google.com',3,false,'Reflected XSS in query parameter: <code><script>alert(1)</script></code>','/mail/search?q=<script>','2025-11-20 09:45:33.987654'),
	 (2,'Open Redirect','login.teamviewer.com',2,true,'Open redirect vulnerability allows redirecting users to arbitrary domains via redirect parameter.','/login?redirect=https://evil.com','2025-11-22 16:12:45.234567'),
	 (1,'Information Disclosure','www.google.com',2,false,'Sensitive information exposed in API response including internal IP addresses and server configuration.','/api/debug/status','2025-11-25 11:30:22.456789'),
	 (2,'Missing Rate Limiting','api.teamviewer.com',2,true,'No rate limiting on authentication endpoint allows brute force attacks.','/api/auth/login','2025-11-28 13:45:18.567890'),
	 (1,'CORS Misconfiguration','accounts.google.com',3,true,'CORS policy allows requests from any origin: <code>Access-Control-Allow-Origin: *</code>','/oauth/authorize','2025-12-01 10:15:30.678901'),
	 (2,'Insecure Direct Object Reference','teamviewer.com',3,false,'IDOR vulnerability allows accessing other users'' sessions by manipulating session ID parameter.','/api/sessions/12345','2025-12-03 08:20:15.789012'),
	 (1,'Subdomain Takeover','dev.google.com',4,true,'Subdomain pointing to unclaimed AWS S3 bucket, allowing complete takeover of subdomain.','/','2025-12-05 14:55:40.890123'),
	 (1,'Directory Listing Enabled','storage.google.com',1,false,'Directory listing is enabled on storage server, exposing file structure.','/backup/','2025-12-06 09:10:25.901234'),
	 (2,'Weak Password Policy','login.teamviewer.com',1,true,'Password policy allows weak passwords. Minimum length is only 4 characters.','/settings/password','2025-12-07 15:30:50.012345'),
	 (1,'Clickjacking','www.google.com',2,false,'Missing X-Frame-Options header allows site to be embedded in iframe for clickjacking attacks.','/','2025-12-08 11:45:35.123456'),
	 (2,'API Key Exposure','api.teamviewer.com',4,true,'Hardcoded API keys found in JavaScript bundle: <code>AIzaSyD-xxxxxxxxxxxxx</code>','/assets/main.js','2025-12-09 16:20:10.234567'),
	 (1,'JWT Signature Not Verified','oauth.google.com',4,false,'JWT tokens accepted without signature verification, allowing token forgery.','/api/verify','2025-12-10 12:35:45.345678'),
	 (2,'XML External Entity (XXE)','upload.teamviewer.com',3,true,'XXE vulnerability in XML file upload allows reading arbitrary files from server.','/api/upload/xml','2025-12-11 10:50:20.456789'),
	 (1,'Server-Side Template Injection','mail.google.com',4,true,'SSTI vulnerability in email template rendering: <code>{{7*7}}</code> evaluates to 49.','/templates/preview','2025-12-11 14:15:55.567890'),
	 (1,'Security Headers Missing','www.google.com',1,false,'Multiple security headers missing: Content-Security-Policy, X-Content-Type-Options, Strict-Transport-Security.','/','2025-12-12 08:30:30.678901'),
	 (2,'Session Fixation','login.teamviewer.com',3,false,'Application accepts session ID from URL parameter, allowing session fixation attacks.','/login?sessionid=attacker','2025-12-12 09:45:15.789012'),
	 (1,'Cookie Without Secure Flag','accounts.google.com',1,true,'Authentication cookie transmitted without Secure flag, vulnerable to interception over HTTP.','/','2025-12-12 11:20:40.890123'),
	 (2,'Insecure Deserialization','api.teamviewer.com',4,false,'Insecure deserialization in session handling allows remote code execution.','/api/session/restore','2025-12-12 13:55:25.901234');