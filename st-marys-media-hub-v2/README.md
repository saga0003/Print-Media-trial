# St. Mary's Media Hub V2

Static prototype for internal social-media planning, approval, scheduling and multi-account destination management.

## Version 2 additions

- Multiple accounts per platform
- Administrator-only Social Accounts screen
- Add, edit, disable and remove account records
- Assign accounts to brands
- Select exact destination accounts for each content item
- Review destinations before approval
- Editor and viewer restrictions

## Local test

Open `index.html`, or run `python -m http.server 8080` inside this folder.

## Vercel

Use Framework Preset `Other`, Root Directory `st-marys-media-hub-v2`, and no build command.

## Prototype limitations

The prototype stores records in browser localStorage. Real OAuth, secure tokens, shared users, durable storage and social publishing APIs are not connected yet.