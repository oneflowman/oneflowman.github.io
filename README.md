# One Flow Man

Portfolio site for **One Flow Man** and **Treestyle Studios**, hosted on GitHub Pages (`oneflowman.com`).

## Preview locally

Because the site loads `data/projects.json` via `fetch`, use a local server from the repo root:

```bash
python -m http.server 8080
```

Then open:

- [http://localhost:8080/](http://localhost:8080/) — One Flow Man primary (variant 2B)
- [http://localhost:8080/index-dual.html](http://localhost:8080/index-dual.html) — dual-brand hero (variant 2A)

## Update games / music

```bash
python tools/project-manager/app.py
```

See [tools/project-manager/README.md](tools/project-manager/README.md).
