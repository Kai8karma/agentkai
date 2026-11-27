# Agent Kai

Source for the Agent Kai website: GTM engineering as tested code.

**Live site:** https://kai8karma.github.io/agentkai/

Agent Kai runs a tested, deterministic GTM engine on a client's CRM to recover revenue trapped in broken pipeline data, inside the client's own environment. This repo is the static marketing site plus the free tools and downloads that go with it.

## What's here

| Path | What it is |
|---|---|
| `index.html`, `assets/` | Main site (pre-built static bundle) |
| `gtmos/` | GTM OS product page, demo video and downloads (source tarball, concept note, sample report, team playbook) |
| `tools/crm-data-quality-grader/` | Free CRM Data Quality Grader. Scores a HubSpot or Salesforce export entirely in the browser. No data leaves the page |
| `llms.txt` | Plain-text summary of the offer for AI answer engines |
| `robots.txt`, `sitemap.xml`, `og.png`, `favicon.svg` | SEO and social metadata |

## Related repos

- [kaikarma-gtm-engine](https://github.com/Kai8karma/kaikarma-gtm-engine): the GTM engine itself (scoring, routing, paid control, tests)
- [gtmos-mcp](https://github.com/Kai8karma/gtmos-mcp): read-only CRM audit as an MCP server for Claude
- [awesome-gtm-engineering](https://github.com/Kai8karma/awesome-gtm-engineering): curated GTM engineering resources

## Running locally

It's static. Serve the folder with any web server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/. The site is deployed with GitHub Pages from `main`.

## License

[MIT](LICENSE)
