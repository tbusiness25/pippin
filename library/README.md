# Health library

Pages from the NHS website that the coach can look things up in, once someone ticks them in
**Me → Coach style & library**. The list of pages is [`sources.json`](sources.json); the copies are in `nhs/`.

## How it works
- `scripts/update-library.js` downloads each page and keeps its wording exactly as published, split into the page's
  own sections. Nothing is summarised or rewritten.
- The coach searches the ticked pages on your server (a simple keyword search, so it works with any AI model and
  needs no extra download). Nothing is sent anywhere to do this.
- When the coach uses a passage, the person sees the **exact NHS text** under its reply, set apart from the coach's
  own words, with a link to the page and the date it was copied.
- Dose information from medicine pages is never indexed. The coach still doesn't advise on medication.

## Updating
NHS pages are reviewed and changed over time. To refresh the copies:
```bash
node scripts/update-library.js                         # needs Node 20+, then rebuild or restart
# or, with Docker, writing into this folder:
docker compose run --rm -v "$PWD/library:/app/library" app node scripts/update-library.js
docker compose up -d --build
```
To add a page, add it to `sources.json` (any page on www.nhs.uk) and run the script.

## Licence and attribution
Information from the NHS website is licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

The copies here are unchanged NHS website content. Each passage is shown with the attribution "Information from the
NHS website, as at DDMMYY" (the date it was copied) and a link back to the page, as the
[NHS website terms](https://www.nhs.uk/our-policies/terms-and-conditions/) require. Images, logos and the NHS
identity are not included. The NHS website team has not reviewed or endorsed Pippin.

### Why there's no NICE guidance
NICE content (such as the ADHD guideline NG87) may only be reused in the UK under the NICE UK Open Content Licence,
and its use for AI purposes needs NICE's approval and a licence. Until that permission is in place, the library uses
NHS website pages only.
