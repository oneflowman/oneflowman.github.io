# Project Manager

Local desktop app to add, edit, and delete Games / Music entries for the portfolio site.

## Requirements

- Python 3 (tkinter is included with the standard Windows installer)

## Run

From the repository root:

```bash
python tools/project-manager/app.py
```

## What it does

- Reads and writes `data/projects.json`
- Copies chosen images into `assets/projects/`
- Lets you edit existing projects (title, URL, date, tag/stamp, image) and delete with confirmation
- **Tag** is the little corner stamp on each card (leave blank to hide)

After saving, commit and push the updated JSON/images to update GitHub Pages.
