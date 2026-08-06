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
        for row, (label, key) in enumerate(fields):
            ttk.Label(right, text=label).grid(row=row, column=0, sticky="w", pady=4)
            entry = ttk.Entry(right)
            entry.grid(row=row, column=1, sticky="ew", pady=4, padx=(8, 0))
            self.entries[key] = entry

        ttk.Label(right, text="Image").grid(row=4, column=0, sticky="w", pady=4)
        img_row = ttk.Frame(right)
        img_row.grid(row=4, column=1, sticky="ew", pady=4, padx=(8, 0))
        img_row.columnconfigure(0, weight=1)
        ttk.Entry(img_row, textvariable=self.image_path).grid(row=0, column=0, sticky="ew")
        ttk.Button(img_row, text="Browse…", command=self.browse_image).grid(
            row=0, column=1, padx=(8, 0)
        )

        self.image_hint = ttk.Label(right, text="Relative path or pick a new file to copy in.")
        self.image_hint.grid(row=5, column=0, columnspan=2, sticky="w", pady=(0, 12))

        action_row = ttk.Frame(right)
        action_row.grid(row=6, column=0, columnspan=2, sticky="ew")
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
        note.grid(row=7, column=0, columnspan=2, sticky="sw", pady=(24, 0))
        right.rowconfigure(7, weight=1)

        self.clear_form()

    def projects(self) -> list[dict[str, Any]]:
        key = self.selected_category.get()
        items = self.data.get(key)
        return items if isinstance(items, list) else []

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
            self.listbox.selection_set(idx)
            self.listbox.see(idx)
            self.selected_id = select_id

    def on_category_change(self) -> None:
        self.clear_form()
        self.refresh_list()

    def on_select(self) -> None:
        sel = self.listbox.curselection()
        if not sel:
            return
        project_id = self._visible_ids[sel[0]]
        project = next((p for p in self.projects() if p.get("id") == project_id), None)
        if not project:
            return
        self.selected_id = project_id
        self.entries["title"].delete(0, tk.END)
        self.entries["title"].insert(0, project.get("title", ""))
        self.entries["url"].delete(0, tk.END)
        self.entries["url"].insert(0, project.get("url", ""))
        self.entries["date"].delete(0, tk.END)
        self.entries["date"].insert(0, project.get("date", ""))
        self.entries["id"].delete(0, tk.END)
        self.entries["id"].insert(0, project.get("id", ""))
        self.entries["id"].configure(state="readonly")
        self.image_path.set(project.get("image", ""))

    def clear_form(self) -> None:
        self.selected_id = None
        self.listbox.selection_clear(0, tk.END)
        for key, entry in self.entries.items():
            entry.configure(state="normal")
            entry.delete(0, tk.END)
        self.entries["date"].insert(0, date.today().isoformat())
        self.image_path.set("")

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

    def save_project(self) -> None:
        title = self.entries["title"].get().strip()
        url = self.entries["url"].get().strip()
        date_str = self.entries["date"].get().strip()
        project_id = self.entries["id"].get().strip()
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
        if not project_id:
            project_id = slugify(title)
            existing_ids = {p.get("id") for p in self.projects()}
            base = project_id
            n = 2
            while project_id in existing_ids:
                project_id = f"{base}-{n}"
                n += 1

        image_path = Path(image_value)
        if image_path.is_file():
            rel_image = copy_image(image_path, project_id)
        elif image_value.startswith("assets/projects/"):
            rel_image = image_value.replace("\\", "/")
            if not (ROOT / rel_image).exists():
                messagebox.showerror(
                    "Image not found",
                    f"Could not find {rel_image} under the site root.",
                )
                return
        else:
            messagebox.showerror(
                "Invalid image",
                "Pick an image file, or keep an existing assets/projects/ path.",
            )
            return

        record = {
            "id": project_id,
            "title": title,
            "url": url,
            "image": rel_image,
            "date": date_str,
        }

        items = list(self.projects())
        if editing:
            items = [record if p.get("id") == self.selected_id else p for p in items]
            # If id somehow changed while editing readonly, still replace by selected_id
            if self.selected_id != project_id:
                items = [p for p in items if p.get("id") != self.selected_id]
                if not any(p.get("id") == project_id for p in items):
                    items.append(record)
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
        self.selected_id = project_id
        self.entries["id"].configure(state="normal")
        self.entries["id"].delete(0, tk.END)
        self.entries["id"].insert(0, project_id)
        self.entries["id"].configure(state="readonly")
        self.image_path.set(rel_image)
        messagebox.showinfo("Saved", f"Saved '{title}' to {category}.")


def main() -> None:
    app = ProjectManagerApp()
    app.mainloop()


if __name__ == "__main__":
    main()
