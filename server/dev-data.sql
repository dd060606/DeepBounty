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
Test</code>','/home/main.js?v=1.1.6','2025-09-07 10:53:08.780525');