#!/usr/bin/env python3
"""Local GUI to add and edit Games / Music projects for the portfolio site."""

from __future__ import annotations

import json
import re
import shutil
import tkinter as tk
from datetime import date
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "projects.json"
PROJECTS_DIR = ROOT / "assets" / "projects"


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or f"project-{uuid4().hex[:8]}"


def load_data() -> dict[str, Any]:
    if not DATA_PATH.exists():
        return {
            "backgrounds": [],
            "about": {"oneFlowMan": "", "treestyleStudios": ""},
            "socials": [],
            "games": [],
            "music": [],
        }
    with DATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data: dict[str, Any]) -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    with DATA_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def copy_image(src: Path, project_id: str) -> str:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    dest_name = f"{project_id}{src.suffix.lower()}"
    dest = PROJECTS_DIR / dest_name
    if src.resolve() != dest.resolve():
        shutil.copy2(src, dest)
    return f"assets/projects/{dest_name}"


class ProjectManagerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("One Flow Man — Project Manager")
        self.geometry("820x560")
        self.minsize(720, 480)

        self.data = load_data()
        self.selected_category = tk.StringVar(value="games")
        self.selected_id: str | None = None
        self.image_path = tk.StringVar(value="")
        self._visible_ids: list[str] = []
        self._loading_form = False

        self._build_ui()
        self.refresh_list()

    def _build_ui(self) -> None:
        self.columnconfigure(0, weight=1)
        self.columnconfigure(1, weight=2)
        self.rowconfigure(0, weight=1)

        left = ttk.Frame(self, padding=12)
        left.grid(row=0, column=0, sticky="nsew")
        left.rowconfigure(2, weight=1)
        left.columnconfigure(0, weight=1)

        ttk.Label(left, text="Category").grid(row=0, column=0, sticky="w")
        cat = ttk.Combobox(
            left,
            textvariable=self.selected_category,
            values=("games", "music"),
            state="readonly",
        )
        cat.grid(row=1, column=0, sticky="ew", pady=(4, 8))
        cat.bind("<<ComboboxSelected>>", lambda _e: self.on_category_change())

        self.listbox = tk.Listbox(left, activestyle="dotbox", exportselection=False)
        self.listbox.grid(row=2, column=0, sticky="nsew")
        self.listbox.bind("<<ListboxSelect>>", lambda _e: self.on_select())

        list_btns = ttk.Frame(left)
        list_btns.grid(row=3, column=0, sticky="ew", pady=(8, 0))
        ttk.Button(list_btns, text="New", command=self.clear_form).pack(side="left")
        ttk.Button(list_btns, text="Delete", command=self.delete_selected).pack(
            side="left", padx=(8, 0)
        )

        right = ttk.Frame(self, padding=12)
        right.grid(row=0, column=1, sticky="nsew")
        right.columnconfigure(1, weight=1)

        fields = [
            ("Title", "title"),
            ("URL", "url"),
            ("Date (YYYY-MM-DD)", "date"),
            ("ID", "id"),
        ]
        self.entries: dict[str, ttk.Entry] = {}
        row = 0
        for label, key in fields:
            ttk.Label(right, text=label).grid(row=row, column=0, sticky="w", pady=4)
            entry = ttk.Entry(right)
            entry.grid(row=row, column=1, sticky="ew", pady=4, padx=(8, 0))
            self.entries[key] = entry
            row += 1

        # Tag gets its own clear block so it's obvious you can type anything
        tag_box = ttk.LabelFrame(right, text="Corner stamp tag — type anything", padding=8)
        tag_box.grid(row=row, column=0, columnspan=2, sticky="ew", pady=(10, 8))
        tag_box.columnconfigure(0, weight=1)
        row += 1

        self.entries["tag"] = ttk.Entry(tag_box)
        self.entries["tag"].grid(row=0, column=0, sticky="ew")
        self.entries["tag"].bind("<KeyRelease>", lambda _e: self.update_tag_preview())
        self.entries["tag"].bind("<FocusOut>", lambda _e: self.update_tag_preview())

        self.tag_preview = ttk.Label(
            tag_box,
            text='Preview: (hidden — type a tag)',
            font=("Segoe UI", 11, "bold"),
        )
        self.tag_preview.grid(row=1, column=0, sticky="w", pady=(8, 0))

        ttk.Label(right, text="Image").grid(row=row, column=0, sticky="w", pady=4)
        img_row = ttk.Frame(right)
        img_row.grid(row=row, column=1, sticky="ew", pady=4, padx=(8, 0))
        img_row.columnconfigure(0, weight=1)
        ttk.Entry(img_row, textvariable=self.image_path).grid(row=0, column=0, sticky="ew")
        ttk.Button(img_row, text="Browse…", command=self.browse_image).grid(
            row=0, column=1, padx=(8, 0)
        )
        row += 1

        action_row = ttk.Frame(right)
        action_row.grid(row=row, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        row += 1
        ttk.Button(action_row, text="Save Project", command=self.save_project).pack(
            side="left"
        )
        ttk.Button(action_row, text="Reload JSON", command=self.reload_data).pack(
            side="left", padx=(8, 0)
        )

        note = ttk.Label(
            right,
            text=f"Writes to:\n{DATA_PATH}\nImages go to:\n{PROJECTS_DIR}",
            justify="left",
        )
        note.grid(row=row, column=0, columnspan=2, sticky="sw", pady=(24, 0))
        right.rowconfigure(row, weight=1)

        self.clear_form()

    def projects(self) -> list[dict[str, Any]]:
        key = self.selected_category.get()
        items = self.data.get(key)
        return items if isinstance(items, list) else []

    def set_entry(self, key: str, value: str, *, readonly: bool = False) -> None:
        entry = self.entries[key]
        entry.configure(state="normal")
        entry.delete(0, tk.END)
        entry.insert(0, value)
        if readonly:
            entry.configure(state="readonly")

    def update_tag_preview(self) -> None:
        tag = self.entries["tag"].get().strip()
        if tag:
            self.tag_preview.configure(text=f'Preview on card:  "{tag.upper()}"')
        else:
            self.tag_preview.configure(text="Preview: (hidden — type a tag)")

    def load_project(self, project: dict[str, Any]) -> None:
        self._loading_form = True
        try:
            self.selected_id = project.get("id")
            self.set_entry("title", project.get("title", ""))
            self.set_entry("url", project.get("url", ""))
            self.set_entry("date", project.get("date", ""))
            self.set_entry("tag", project.get("tag", ""))
            self.set_entry("id", project.get("id", ""), readonly=True)
            self.image_path.set(project.get("image", ""))
            self.update_tag_preview()
        finally:
            self._loading_form = False

    def refresh_list(self, select_id: str | None = None) -> None:
        self.listbox.delete(0, tk.END)
        items = sorted(
            self.projects(),
            key=lambda p: p.get("date") or "",
            reverse=True,
        )
        self._visible_ids = [p.get("id", "") for p in items]
        for p in items:
            title = p.get("title") or "(untitled)"
            date_str = p.get("date") or "no-date"
            self.listbox.insert(tk.END, f"{date_str}  ·  {title}")

        if select_id and select_id in self._visible_ids:
            idx = self._visible_ids.index(select_id)
            self.listbox.selection_clear(0, tk.END)
            self.listbox.selection_set(idx)
            self.listbox.activate(idx)
            self.listbox.see(idx)
            project = next((p for p in items if p.get("id") == select_id), None)
            if project:
                self.load_project(project)
        elif select_id is None:
            pass
        else:
            self.selected_id = None

    def on_category_change(self) -> None:
        self.clear_form()
        self.refresh_list()

    def on_select(self) -> None:
        if self._loading_form:
            return
        sel = self.listbox.curselection()
        if not sel:
            return
        project_id = self._visible_ids[sel[0]]
        project = next((p for p in self.projects() if p.get("id") == project_id), None)
        if not project:
            return
        self.load_project(project)

    def clear_form(self) -> None:
        self._loading_form = True
        try:
            self.selected_id = None
            self.listbox.selection_clear(0, tk.END)
            self.set_entry("title", "")
            self.set_entry("url", "")
            self.set_entry("date", date.today().isoformat())
            self.set_entry("tag", "")
            self.set_entry("id", "")
            self.image_path.set("")
            self.update_tag_preview()
        finally:
            self._loading_form = False

    def browse_image(self) -> None:
        path = filedialog.askopenfilename(
            title="Choose project image",
            filetypes=[
                ("Images", "*.png *.jpg *.jpeg *.webp *.gif"),
                ("All files", "*.*"),
            ],
        )
        if path:
            self.image_path.set(path)

    def reload_data(self) -> None:
        self.data = load_data()
        current = self.selected_id
        self.refresh_list(select_id=current)
        messagebox.showinfo("Reloaded", "Loaded latest projects.json")

    def delete_selected(self) -> None:
        if not self.selected_id:
            messagebox.showwarning("No selection", "Select a project to delete.")
            return
        if not messagebox.askyesno(
            "Delete project",
            f"Delete '{self.selected_id}' from {self.selected_category.get()}?",
        ):
            return
        key = self.selected_category.get()
        self.data[key] = [p for p in self.projects() if p.get("id") != self.selected_id]
        save_data(self.data)
        self.clear_form()
        self.refresh_list()

    def resolve_image(self, image_value: str, project_id: str) -> str | None:
        image_path = Path(image_value)
        if image_path.is_file():
            return copy_image(image_path, project_id)

        rel_image = image_value.replace("\\", "/")
        if rel_image.startswith("assets/projects/"):
            if not (ROOT / rel_image).exists():
                messagebox.showerror(
                    "Image not found",
                    f"Could not find {rel_image} under the site root.",
                )
                return None
            return rel_image

        messagebox.showerror(
            "Invalid image",
            "Pick an image file, or keep an existing assets/projects/ path.",
        )
        return None

    def save_project(self) -> None:
        title = self.entries["title"].get().strip()
        url = self.entries["url"].get().strip()
        date_str = self.entries["date"].get().strip()
        tag = self.entries["tag"].get().strip()
        image_value = self.image_path.get().strip()
        category = self.selected_category.get()

        if not title:
            messagebox.showerror("Missing title", "Title is required.")
            return
        if not url:
            messagebox.showerror("Missing URL", "URL is required.")
            return
        if not date_str:
            messagebox.showerror("Missing date", "Date is required (YYYY-MM-DD).")
            return
        if not image_value:
            messagebox.showerror("Missing image", "Choose an image for the project.")
            return

        editing = self.selected_id is not None
        # When editing, always keep the selected project's id — never trust a stale field.
        if editing:
            project_id = self.selected_id
        else:
            typed_id = self.entries["id"].get().strip()
            project_id = typed_id or slugify(title)
            existing_ids = {p.get("id") for p in self.projects()}
            base = project_id
            n = 2
            while project_id in existing_ids:
                project_id = f"{base}-{n}"
                n += 1

        rel_image = self.resolve_image(image_value, project_id)
        if rel_image is None:
            return

        record = {
            "id": project_id,
            "title": title,
            "url": url,
            "image": rel_image,
            "date": date_str,
            "tag": tag,
        }

        items = list(self.projects())
        if editing:
            replaced = False
            new_items: list[dict[str, Any]] = []
            for p in items:
                if p.get("id") == self.selected_id and not replaced:
                    new_items.append(record)
                    replaced = True
                elif p.get("id") == self.selected_id:
                    # Drop accidental duplicates of the same id
                    continue
                else:
                    new_items.append(p)
            if not replaced:
                new_items.append(record)
            items = new_items
        else:
            if any(p.get("id") == project_id for p in items):
                messagebox.showerror(
                    "Duplicate ID",
                    f"A project with id '{project_id}' already exists.",
                )
                return
            items.append(record)

        self.data[category] = items
        save_data(self.data)
        self.refresh_list(select_id=project_id)
        messagebox.showinfo("Saved", f"Saved '{title}' to {category}.")


def main() -> None:
    app = ProjectManagerApp()
    app.mainloop()


if __name__ == "__main__":
    main()
