# Project Lazarus Stations 1-3 Socratic Coach, Netlify Version

This version avoids `script.google.com`. Students only open the Netlify URL.

## Environment variables required in Netlify

Set these in Netlify:
Site configuration > Environment variables

Required:
- OPENAI_API_KEY
- OPENAI_MODEL = gpt-4.1-mini
- TEACHER_PASSWORD

Optional:
- SAPLING_API_KEY

Do not put API keys in public HTML or JavaScript files.

## Deploy

1. Create a GitHub repository.
2. Upload these files.
3. In Netlify, choose Add new site > Import an existing project.
4. Choose the repository.
5. Build command: npm run build
6. Publish directory: public
7. Add environment variables.
8. Deploy.

Students use:
https://YOUR-SITE.netlify.app/

Teacher dashboard:
https://YOUR-SITE.netlify.app/admin.html

## Local testing

Install Node.js, then:

npm install
npx netlify dev

Add local variables using Netlify CLI or a .env file for testing only. Do not commit .env.
