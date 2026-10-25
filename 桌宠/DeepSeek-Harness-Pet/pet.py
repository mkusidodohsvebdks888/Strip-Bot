from __future__ import annotations

import math
import random
import sys
import threading
import time
import tkinter as tk
from pathlib import Path

from PIL import Image, ImageTk

from harness_status import read_status


SOURCE_DIR = Path(__file__).resolve().parent
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", SOURCE_DIR))
ASSET_DIR = BUNDLE_DIR / "assets" / "selected"
KEY_GREEN = "#00ff00"
WINDOW_WIDTH = 440
WINDOW_HEIGHT = 720
IMAGE_WIDTH = 340
IMAGE_HEIGHT = 680
POLL_MS = 2000


class HarnessPet:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg=KEY_GREEN)
        self.root.attributes("-transparentcolor", KEY_GREEN)
        self.scale_factor = 1.0
        self.window_width = WINDOW_WIDTH
        self.window_height = WINDOW_HEIGHT
        self.image_width = IMAGE_WIDTH
        self.image_height = IMAGE_HEIGHT
        self._place_window()

        self.canvas = tk.Canvas(
            self.root,
            width=self.window_width,
            height=self.window_height,
            bg=KEY_GREEN,
            highlightthickness=0,
            bd=0,
        )
        self.canvas.pack()
        self.frame_sources = self._load_frame_sources()
        self.frames = self._build_frames()
        self.current_frame_name = "idle_open"
        self.character = self.canvas.create_image(
            self.window_width // 2,
            self.image_height // 2 + int(14 * self.scale_factor),
            image=self.frames[self.current_frame_name],
            anchor="center",
            tags=("character",),
        )
        self.badge_items: list[int] = []
        self.particle_items: list[int] = []
        self.drag_origin: tuple[int, int] | None = None
        self.was_dragged = False
        self.status = self._offline_status("正在连接 Harness…")
        self.task_panel: tk.Toplevel | None = None
        self.panel_labels: dict[str, tk.Label] = {}
        self.blink_until = 0.0
        self.next_blink_at = time.monotonic() + random.uniform(2.5, 5.0)
        self.is_polling = False

        self._bind_events()
        self._draw_badge()
        self._tick_animation()
        self._poll_status()

    def _place_window(self) -> None:
        self.root.update_idletasks()
        x = max(12, self.root.winfo_screenwidth() - self.window_width - 24)
        y = max(12, self.root.winfo_screenheight() - self.window_height - 70)
        self.root.geometry(f"{self.window_width}x{self.window_height}+{x}+{y}")

    def _load_frame_sources(self) -> dict[str, Image.Image]:
        names = {
            "idle_open": "01_idle_open.png",
            "idle_blink": "02_idle_blink.png",
            "working": "03_working.png",
            "complete": "04_complete.png",
            "resting": "05_resting.png",
        }
        frames: dict[str, Image.Image] = {}
        for key, filename in names.items():
            path = ASSET_DIR / filename
            if not path.exists():
                raise FileNotFoundError(f"缺少桌宠图片：{path}")
            frames[key] = Image.open(path).convert("RGBA")
        return frames

    def _build_frames(self) -> dict[str, ImageTk.PhotoImage]:
        frames: dict[str, ImageTk.PhotoImage] = {}
        for key, source in self.frame_sources.items():
            image = source.resize((self.image_width, self.image_height), Image.Resampling.LANCZOS)
            image = self._remove_green_background(image)
            frames[key] = ImageTk.PhotoImage(image)
        return frames

    @staticmethod
    def _remove_green_background(image: Image.Image) -> Image.Image:
        """Binary chroma key for a Windows color-key transparent window.

        Tk draws semi-transparent image pixels over the green canvas before
        Windows applies its color key, which exposes a neon fringe. Therefore
        this deliberately produces only fully opaque subject pixels and fully
        transparent background pixels after the final resize.
        """
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                red, green, blue, alpha = pixels[x, y]
                green_bias = green - max(red, blue)
                if alpha == 0 or (green > 70 and green_bias > 8):
                    pixels[x, y] = (0, 0, 0, 0)
                else:
                    # Any remaining low-strength green spill is neutralized before
                    # it reaches Tk's green color-key canvas.
                    if green_bias > 0:
                        green = min(green, max(red, blue) + 2)
                    pixels[x, y] = (red, green, blue, 255)
        return image

    def _bind_events(self) -> None:
        self.canvas.bind("<ButtonPress-1>", self._start_drag)
        self.canvas.bind("<B1-Motion>", self._drag)
        self.canvas.bind("<ButtonRelease-1>", self._stop_drag)
        self.canvas.bind("<Button-3>", self._show_menu)
        self.root.bind("<Escape>", lambda _event: self._quit())
        self.root.bind_all("<Control-MouseWheel>", self._on_zoom_wheel)
        self.root.bind_all("<Control-plus>", lambda _event: self._set_scale(self.scale_factor + 0.1))
        self.root.bind_all("<Control-minus>", lambda _event: self._set_scale(self.scale_factor - 0.1))

    def _start_drag(self, event: tk.Event) -> None:
        self.drag_origin = (event.x_root, event.y_root)
        self.was_dragged = False

    def _drag(self, event: tk.Event) -> None:
        if self.drag_origin is None:
            return
        origin_x, origin_y = self.drag_origin
        current_x = self.root.winfo_x() + event.x_root - origin_x
        current_y = self.root.winfo_y() + event.y_root - origin_y
        if abs(event.x_root - origin_x) + abs(event.y_root - origin_y) > 3:
            self.was_dragged = True
        self.root.geometry(f"+{current_x}+{current_y}")
        if self._task_panel_is_visible():
            self._position_task_panel()
        self.drag_origin = (event.x_root, event.y_root)

    def _stop_drag(self, _event: tk.Event) -> None:
        should_toggle_panel = not self.was_dragged
        self.drag_origin = None
        self.was_dragged = False
        if should_toggle_panel:
            self._toggle_task_panel()

    def _show_menu(self, event: tk.Event) -> None:
        menu = tk.Menu(self.root, tearoff=False)
        menu.add_command(label="显示 / 隐藏任务面板", command=self._toggle_task_panel)
        menu.add_separator()
        menu.add_command(label="放大 10%", command=lambda: self._set_scale(self.scale_factor + 0.1))
        menu.add_command(label="缩小 10%", command=lambda: self._set_scale(self.scale_factor - 0.1))
        menu.add_command(label="还原为 100%", command=lambda: self._set_scale(1.0))
        menu.add_separator()
        menu.add_command(label="退出桌宠", command=self._quit)
        menu.tk_popup(event.x_root, event.y_root)
        menu.grab_release()

    def _on_zoom_wheel(self, event: tk.Event) -> str:
        step = 0.1 if event.delta > 0 else -0.1
        self._set_scale(self.scale_factor + step)
        return "break"

    def _set_scale(self, requested: float) -> None:
        scale = max(0.25, min(1.45, round(requested, 2)))
        if abs(scale - self.scale_factor) < 0.01:
            return
        self.scale_factor = scale
        self.window_width = int(WINDOW_WIDTH * scale)
        self.window_height = int(WINDOW_HEIGHT * scale)
        self.image_width = int(IMAGE_WIDTH * scale)
        self.image_height = int(IMAGE_HEIGHT * scale)
        if scale < 0.55:
            # At thumbnail size the pet may shrink, but the task-state badge
            # remains a readable control with its own reserved space below it.
            self.window_width = max(self.window_width, 170)
            self.window_height = max(self.window_height, self.image_height + 54)
        self.frames = self._build_frames()
        self.canvas.configure(width=self.window_width, height=self.window_height)
        self.root.geometry(f"{self.window_width}x{self.window_height}+{self.root.winfo_x()}+{self.root.winfo_y()}")
        self.canvas.itemconfigure(self.character, image=self.frames[self.current_frame_name])
        self._draw_badge()
        if self._task_panel_is_visible():
            self._position_task_panel()

    def _quit(self) -> None:
        self.root.destroy()

    @staticmethod
    def _offline_status(message: str) -> dict:
        return {
            "state": "offline",
            "percent": None,
            "completed": 0,
            "total": 0,
            "inProgress": 0,
            "currentTask": None,
            "todos": [],
            "message": message,
        }

    def _poll_status(self) -> None:
        if not self.is_polling:
            self.is_polling = True
            thread = threading.Thread(target=self._read_status_worker, daemon=True)
            thread.start()
        self.root.after(POLL_MS, self._poll_status)

    def _read_status_worker(self) -> None:
        try:
            status = read_status()
        except Exception:
            status = self._offline_status("暂时无法读取任务")
        self.root.after(0, lambda: self._apply_status(status))

    def _apply_status(self, status: dict) -> None:
        self.is_polling = False
        self.status = status
        self._draw_badge()
        self._refresh_task_panel()

    def _choose_frame(self, now: float) -> str:
        state = self.status.get("state")
        if state == "working":
            return "working"
        if state == "completed":
            return "complete"
        if state in {"offline", "error", "idle"}:
            return "resting"
        if state == "working_without_todos":
            return "idle_open"
        if now >= self.next_blink_at:
            self.blink_until = now + 0.16
            self.next_blink_at = now + random.uniform(3.0, 6.5)
        return "idle_blink" if now < self.blink_until else "idle_open"

    def _tick_animation(self) -> None:
        now = time.monotonic()
        frame_name = self._choose_frame(now)
        if frame_name != self.current_frame_name:
            self.current_frame_name = frame_name
            self.canvas.itemconfigure(self.character, image=self.frames[frame_name])
        bob = int(round(math.sin(now * 2.1) * 4))
        self.canvas.coords(
            self.character,
            self.window_width // 2,
            self.image_height // 2 + int(14 * self.scale_factor) + bob,
        )
        self._draw_particles(now)
        self.root.after(33, self._tick_animation)

    def _draw_particles(self, now: float) -> None:
        for item in self.particle_items:
            self.canvas.delete(item)
        self.particle_items.clear()
        state = self.status.get("state")
        if state not in {"working", "completed"}:
            return
        count = 4 if state == "working" else 6
        for index in range(count):
            phase = now * (1.2 + index * 0.08) + index * 1.7
            x = int((300 + math.sin(phase) * 34) * self.scale_factor)
            y = int((160 + math.cos(phase * 1.4) * 52) * self.scale_factor)
            radius = max(2, int((3 + (index % 3)) * self.scale_factor))
            color = "#51e8ff" if state == "working" else "#b6f8ff"
            self.particle_items.append(
                self.canvas.create_oval(x - radius, y - radius, x + radius, y + radius, outline=color, width=1)
            )

    @staticmethod
    def _status_style(state: object) -> tuple[str, str]:
        return {
            "working": ("正在执行", "#49ddff"),
            "completed": ("任务完成", "#a9f7d6"),
            "working_without_todos": ("正在处理", "#49ddff"),
            "idle": ("等待任务", "#b8d9ff"),
            "offline": ("未连接", "#b0bac8"),
            "error": ("读取失败", "#ffb5c4"),
        }.get(state, ("等待任务", "#b8d9ff"))

    def _draw_badge(self) -> None:
        for item in self.badge_items:
            self.canvas.delete(item)
        self.badge_items.clear()
        state_text, accent = self._status_style(self.status.get("state"))
        scale = self.scale_factor
        if scale < 0.55:
            x1, y1, x2, y2 = ((self.window_width - 142) // 2, self.image_height + 12, (self.window_width + 142) // 2, self.image_height + 44)
            dot = (x1 + 12, y1 + 11, x1 + 20, y1 + 19)
            text_x, text_y, text_size = x1 + 29, y1 + 16, 11
            border_width = 2
        else:
            x1, y1, x2, y2 = (int(value * scale) for value in (14, 654, 156, 686))
            dot = (int(26 * scale), int(665 * scale), int(34 * scale), int(673 * scale))
            text_x, text_y, text_size = int(43 * scale), int(670 * scale), max(9, int(11 * scale))
            border_width = max(1, int(2 * scale))
        self.badge_items.append(self.canvas.create_rectangle(
            x1, y1, x2, y2, fill="#101b2a", outline=accent, width=border_width,
        ))
        self.badge_items.append(self.canvas.create_oval(
            *dot, fill=accent, outline="",
        ))
        self.badge_items.append(self.canvas.create_text(
            text_x, text_y, text=state_text, anchor="w", fill="#f4fbff",
            font=("Microsoft YaHei UI", text_size, "bold"),
        ))

    def _task_panel_is_visible(self) -> bool:
        return self.task_panel is not None and bool(self.task_panel.winfo_viewable())

    def _position_task_panel(self) -> None:
        if self.task_panel is None:
            return
        width, height = 420, 430
        x = self.root.winfo_x() - width - 14
        if x < 12:
            x = self.root.winfo_x() + self.window_width + 14
        y = min(max(12, self.root.winfo_y() + 92), self.root.winfo_screenheight() - height - 54)
        self.task_panel.geometry(f"{width}x{height}+{x}+{y}")

    def _create_task_panel(self) -> None:
        panel = tk.Toplevel(self.root)
        panel.overrideredirect(True)
        panel.attributes("-topmost", True)
        panel.configure(bg="#101925")
        panel.withdraw()
        panel.bind("<Escape>", lambda _event: self._hide_task_panel())
        panel.protocol("WM_DELETE_WINDOW", self._hide_task_panel)

        outer = tk.Frame(panel, bg="#101925", highlightbackground="#4bdaff", highlightthickness=2)
        outer.pack(fill="both", expand=True)
        header = tk.Frame(outer, bg="#152336")
        header.pack(fill="x")
        tk.Label(
            header, text="DEEPSEEK HARNESS", bg="#152336", fg="#8be9ff",
            font=("Segoe UI", 10, "bold"), padx=18, pady=12,
        ).pack(side="left")
        tk.Button(
            header, text="×", command=self._hide_task_panel, bg="#152336", fg="#d8efff",
            activebackground="#233a57", activeforeground="#ffffff", relief="flat",
            font=("Segoe UI", 16), width=3, bd=0,
        ).pack(side="right", padx=6)

        body = tk.Frame(outer, bg="#101925", padx=22, pady=16)
        body.pack(fill="both", expand=True)
        self.panel_labels["status"] = tk.Label(
            body, bg="#101925", fg="#49ddff", anchor="w",
            font=("Microsoft YaHei UI", 15, "bold"),
        )
        self.panel_labels["status"].pack(fill="x")
        summary = tk.Frame(body, bg="#101925")
        summary.pack(fill="x", pady=(8, 10))
        self.panel_labels["percent"] = tk.Label(
            summary, bg="#101925", fg="#ffffff", anchor="w",
            font=("Segoe UI", 36, "bold"),
        )
        self.panel_labels["percent"].pack(side="left")
        self.panel_labels["count"] = tk.Label(
            summary, bg="#101925", fg="#c9d8e9", justify="left", anchor="w",
            font=("Microsoft YaHei UI", 13),
        )
        self.panel_labels["count"].pack(side="left", padx=(16, 0))
        tk.Frame(body, bg="#2b4968", height=1).pack(fill="x", pady=(0, 14))
        self.panel_labels["section"] = tk.Label(
            body, text="任务清单", bg="#101925", fg="#8be9ff", anchor="w",
            font=("Microsoft YaHei UI", 12, "bold"),
        )
        self.panel_labels["section"].pack(fill="x")
        self.panel_labels["tasks"] = tk.Label(
            body, bg="#101925", fg="#f2f7ff", anchor="nw", justify="left",
            wraplength=365, font=("Microsoft YaHei UI", 14), pady=9,
        )
        self.panel_labels["tasks"].pack(fill="both", expand=True)
        self.panel_labels["hint"] = tk.Label(
            body, text="点击角色收起面板 · 拖动角色移动", bg="#101925", fg="#7f9bb7",
            anchor="w", font=("Microsoft YaHei UI", 10),
        )
        self.panel_labels["hint"].pack(fill="x")
        self.task_panel = panel

    def _show_task_panel(self) -> None:
        if self.task_panel is None:
            self._create_task_panel()
        self._position_task_panel()
        self.task_panel.deiconify()
        self.task_panel.lift()
        self._refresh_task_panel()

    def _hide_task_panel(self) -> None:
        if self.task_panel is not None:
            self.task_panel.withdraw()

    def _toggle_task_panel(self) -> None:
        if self._task_panel_is_visible():
            self._hide_task_panel()
        else:
            self._show_task_panel()

    def _refresh_task_panel(self) -> None:
        if self.task_panel is None:
            return
        state_text, accent = self._status_style(self.status.get("state"))
        percent = self.status.get("percent")
        completed = int(self.status.get("completed") or 0)
        total = int(self.status.get("total") or 0)
        self.panel_labels["status"].configure(text=state_text, fg=accent)
        if isinstance(percent, int):
            self.panel_labels["percent"].configure(text=f"{percent}%")
            self.panel_labels["count"].configure(text=f"{completed} / {total} 项\n已完成")
        else:
            self.panel_labels["percent"].configure(text="—")
            self.panel_labels["count"].configure(text="未提供\n待办清单")

        todos = self.status.get("todos")
        if isinstance(todos, list) and todos:
            markers = {"completed": "✓  已完成", "in_progress": "●  进行中", "pending": "○  等待"}
            lines = []
            for todo in todos[:4]:
                if isinstance(todo, dict) and isinstance(todo.get("content"), str):
                    marker = markers.get(todo.get("status"), "○  等待")
                    lines.append(f"{marker}  {todo['content'].strip()}")
            if len(todos) > 4:
                lines.append(f"… 还有 {len(todos) - 4} 项")
            self.panel_labels["tasks"].configure(text="\n\n".join(lines) or "暂无可显示任务")
        else:
            message = self.status.get("message") if self.status.get("state") in {"offline", "error"} else None
            self.panel_labels["tasks"].configure(
                text=(message or "这次任务没有写入待办清单。\n桌宠不会猜测进度。")
            )

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    try:
        HarnessPet().run()
    except Exception as exc:
        import tkinter.messagebox as messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("DeepSeek 桌宠无法启动", str(exc))
        root.destroy()
        sys.exit(1)
