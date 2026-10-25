"""Nono desktop companion. Standard-library runtime, Windows only."""
import ctypes
import json
import math
import os
from pathlib import Path
import random
import sys
import time
import queue
import threading
from stripbot_client import StripBotClient

BASE = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
ASSETS = BASE / 'assets'
KEY = '#ff00ff'
FONT = ('Microsoft YaHei UI', 10)
SIZES = (150, 220, 300)

def validate_assets():
    sizes = json.loads((ASSETS / 'sizes.json').read_text())
    for size in SIZES:
        assert str(size) in sizes
        for frame in range(4):
            path = ASSETS / f'pet_{size}_{frame}.png'
            assert path.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n', str(path)
    return sizes

def primary_workarea(root):
    from ctypes import wintypes
    rect = wintypes.RECT()
    if ctypes.windll.user32.SystemParametersInfoW(48, 0, ctypes.byref(rect), 0):
        return rect.left, rect.top, rect.right, rect.bottom
    return 0, 0, root.winfo_screenwidth(), root.winfo_screenheight()

class Nono:
    def __init__(self, root, sizes):
        self.root = root
        self.client = StripBotClient()
        self.results = queue.Queue()
        self.history = []
        self.network_busy = False
        self.shutdown = threading.Event()
        self.sizes = sizes
        self.closed = False
        self.sleeping = False
        self.dragged = False
        self.drag = None
        self.jump_at = -100.0
        self.click_job = self.bubble_job = self.reminder_job = None
        self.dialog = None
        self.frame_cache = {}
        self.settings_path = Path(os.getenv('LOCALAPPDATA', str(Path.home()))) / 'NonoDesktop' / 'settings.json'
        settings = {}
        try:
            settings = json.loads(self.settings_path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            pass
        self.size = settings.get('size', 150)
        if self.size not in SIZES:
            self.size = 150
        self.top = tk.BooleanVar(value=bool(settings.get('topmost', True)))
        self.motion = tk.BooleanVar(value=bool(settings.get('motion', True)))
        self.size_var = tk.IntVar(value=self.size)
        root.withdraw()
        root.title('糯糯 · 桌面玩偶')
        root.overrideredirect(True)
        root.configure(bg=KEY)
        root.wm_attributes('-transparentcolor', KEY)
        root.wm_attributes('-topmost', self.top.get())
        self.canvas = tk.Canvas(root, bg=KEY, highlightthickness=0, bd=0, cursor='hand2')
        self.canvas.pack(fill='both', expand=True)
        self.image_id = self.canvas.create_image(0, 0, anchor='nw')
        self.zz = self.canvas.create_text(0, 0, text='', fill='#80788b', font=('Segoe UI', 14))
        self.bubble = tk.Toplevel(root)
        self.bubble.withdraw()
        self.bubble.overrideredirect(True)
        self.bubble.attributes('-topmost', self.top.get())
        self.bubble.configure(bg='#eadde2')
        self.bubble_label = tk.Label(self.bubble, bg='#fff9fb', fg='#655b66', font=FONT,
                                     padx=14, pady=10, wraplength=240, justify='left')
        self.bubble_label.pack(padx=1, pady=1)
        self.bubble_label.bind('<Button-1>', lambda e: self.bubble.withdraw())
        self.build_menu()
        self.canvas.bind('<ButtonPress-1>', self.press)
        self.canvas.bind('<B1-Motion>', self.drag_move)
        self.canvas.bind('<ButtonRelease-1>', self.release)
        self.canvas.bind('<Double-Button-1>', self.double_click)
        self.canvas.bind('<Button-3>', self.popup)
        root.bind('<Escape>', lambda e: self.close())
        root.protocol('WM_DELETE_WINDOW', self.close)
        self.set_size(self.size, reset=True)
        root.deiconify()
        self.tick()
        root.after(100, self.poll_results)
        threading.Thread(target=self.monitor_connection, daemon=True).start()
        root.after(700, lambda: self.say('已连接 Strip Bot。\n双击我，可以向当前 API 模型提问。', 6500))

    def monitor_connection(self):
        failures = 0
        while not self.shutdown.is_set():
            try:
                self.client.heartbeat()
                failures = 0
            except Exception:
                failures += 1
                if failures >= 3:
                    self.results.put(('shutdown', None))
                    return
            self.shutdown.wait(3)

    def poll_results(self):
        if self.closed:
            return
        try:
            while True:
                callback, value = self.results.get_nowait()
                if callback == 'shutdown':
                    self.close()
                    return
                callback(value)
        except queue.Empty:
            pass
        self.root.after(80, self.poll_results)

    def build_menu(self):
        self.menu = tk.Menu(self.root, tearoff=False, font=FONT)
        self.menu.add_command(label='和糯糯说句话…', command=self.open_chat)
        self.menu.add_command(label='跳一下', command=self.jump)
        self.menu.add_command(label='睡觉 / 起床', command=self.toggle_sleep)
        self.menu.add_separator()
        self.menu.add_checkbutton(label='保持置顶', variable=self.top, command=self.apply_top)
        self.menu.add_checkbutton(label='允许动画', variable=self.motion)
        sub = tk.Menu(self.menu, tearoff=False, font=FONT)
        for size, name in [(150, '小 · 150px'), (220, '中 · 220px'), (300, '大 · 300px')]:
            sub.add_radiobutton(label=name, variable=self.size_var, value=size,
                                command=lambda s=size: self.set_size(s))
        self.menu.add_cascade(label='玩偶大小', menu=sub)
        timer = tk.Menu(self.menu, tearoff=False, font=FONT)
        for minutes in (5, 25, 50):
            timer.add_command(label=f'{minutes} 分钟后提醒休息', command=lambda m=minutes: self.set_reminder(m))
        timer.add_command(label='取消提醒', command=self.cancel_reminder)
        self.menu.add_cascade(label='休息提醒', menu=timer)
        self.menu.add_command(label='回到主屏幕右下角', command=self.reset_position)
        self.menu.add_separator()
        self.menu.add_command(label='退出糯糯', command=self.close)

    def apply_top(self):
        self.root.attributes('-topmost', self.top.get())
        self.bubble.attributes('-topmost', self.top.get())
        if self.dialog and self.dialog.winfo_exists():
            self.dialog.attributes('-topmost', self.top.get())

    def set_size(self, size, reset=False):
        self.bubble.withdraw()
        self.size = size
        self.size_var.set(size)
        if size not in self.frame_cache:
            self.frame_cache[size] = [tk.PhotoImage(master=self.root, file=str(ASSETS / f'pet_{size}_{i}.png')) for i in range(4)]
        self.frames = self.frame_cache[size]
        self.height = self.sizes[str(size)]['height'] + 38
        self.canvas.configure(width=size, height=self.height)
        self.canvas.itemconfigure(self.image_id, image=self.frames[0])
        self.canvas.coords(self.image_id, 0, 32)
        self.canvas.coords(self.zz, size * .76, 20)
        if reset:
            self.reset_position()
        else:
            self.root.geometry(f'{size}x{self.height}')

    def reset_position(self):
        left, top, right, bottom = primary_workarea(self.root)
        self.root.geometry(f'{self.size}x{self.height}+{max(left,right-self.size-36)}+{max(top,bottom-self.height-18)}')
        self.bubble.withdraw()

    def press(self, e):
        self.dragged = False
        self.drag = (e.x_root, e.y_root, self.root.winfo_x(), self.root.winfo_y())
        self.canvas.focus_set()
        self.bubble.withdraw()

    def drag_move(self, e):
        if self.drag is None:
            return
        x0, y0, wx, wy = self.drag
        dx, dy = e.x_root-x0, e.y_root-y0
        if abs(dx)+abs(dy) > 5:
            self.dragged = True
        if self.dragged:
            left, top, right, bottom = primary_workarea(self.root)
            x = max(left, min(right-self.size, wx+dx))
            y = max(top, min(bottom-self.height, wy+dy))
            self.root.geometry(f'{self.size}x{self.height}+{x}+{y}')

    def release(self, e):
        if not self.dragged:
            if self.click_job:
                self.root.after_cancel(self.click_job)
            self.click_job = self.root.after(300, self.clicked)
        self.drag = None

    def clicked(self):
        self.click_job = None
        if self.dialog and self.dialog.winfo_exists():
            return
        if self.sleeping:
            self.toggle_sleep()
        else:
            self.jump()
            self.say(random.choice(['我在这里～', '收到你的贴贴啦。', '今天也给自己一点休息时间。', '嘿嘿，被你发现啦！']))

    def double_click(self, e):
        if self.click_job:
            self.root.after_cancel(self.click_job)
            self.click_job = None
        self.open_chat()
        return 'break'

    def popup(self, e):
        self.bubble.withdraw()
        try:
            self.menu.tk_popup(e.x_root, e.y_root)
        finally:
            self.menu.grab_release()

    def jump(self):
        self.sleeping = False
        self.jump_at = time.monotonic()

    def toggle_sleep(self):
        self.sleeping = not self.sleeping
        self.say('我安静待一会儿，点我就醒。' if self.sleeping else '醒啦，继续陪着你。')

    def tick(self):
        if self.closed:
            return
        now = time.monotonic()
        frame = int(now/.42) % 4 if self.motion.get() and not self.sleeping else 0
        age = now-self.jump_at
        hop = 18*math.sin(math.pi*age/.7) if 0 <= age <= .7 and self.motion.get() else 0
        lift = 1.5*math.sin(now*1.6) if self.motion.get() and not self.sleeping else 0
        self.canvas.itemconfigure(self.image_id, image=self.frames[frame])
        self.canvas.coords(self.image_id, 0, 32-hop-lift)
        self.canvas.itemconfigure(self.zz, text='z Z' if self.sleeping else '')
        self.root.after(50 if self.motion.get() and not self.sleeping else 250, self.tick)

    def say(self, text, duration=4200):
        if self.closed:
            return
        if self.bubble_job:
            self.root.after_cancel(self.bubble_job)
        self.bubble_label.configure(text=text)
        self.bubble.update_idletasks()
        bw, bh = self.bubble.winfo_reqwidth(), self.bubble.winfo_reqheight()
        x = self.root.winfo_x() + (self.size-bw)//2
        y = self.root.winfo_y()-bh+14
        u = ctypes.windll.user32
        vx, vy, vw, vh = [u.GetSystemMetrics(i) for i in (76, 77, 78, 79)]
        x = max(vx+4, min(x, vx+vw-bw-4))
        y = max(vy+4, min(y, vy+vh-bh-4))
        self.bubble.geometry(f'{bw}x{bh}{x:+d}{y:+d}')
        self.bubble.deiconify()
        self.bubble.lift()
        self.bubble_job = self.root.after(duration, self.hide_bubble)

    def hide_bubble(self):
        self.bubble.withdraw()
        self.bubble_job = None

    def set_reminder(self, minutes):
        if self.reminder_job:
            self.root.after_cancel(self.reminder_job)
        self.reminder_job = self.root.after(minutes*60000, self.remind)
        self.say(f'好，{minutes} 分钟后提醒你休息。')

    def remind(self):
        self.reminder_job = None
        self.jump()
        self.say('休息时间到啦。\n放松肩膀，看看远处，喝口水。', 12000)

    def cancel_reminder(self):
        if self.reminder_job:
            self.root.after_cancel(self.reminder_job)
            self.reminder_job = None
        self.say('已取消休息提醒。')

    def reply(self, text):
        if any(w in text for w in ('跳', '加油')):
            self.jump()
            return '给你跳一下！一步一步来就好。'
        if any(w in text for w in ('睡觉', '安静')):
            self.sleeping = True
            return '我安静陪着你，点我就醒。'
        if any(w in text for w in ('起床', '醒醒')):
            self.sleeping = False
            return '醒啦，我在这里！'
        if any(w in text for w in ('计时', '提醒')):
            self.set_reminder(25)
            return '已设置 25 分钟后的休息提醒。'
        if any(w in text for w in ('你好', '嗨', 'hello')):
            return '你好呀。今天也很高兴见到你！'
        if any(w in text for w in ('累', '烦', '难过')):
            return '辛苦了。可以先停一小会儿，我在这里陪你。'
        return '收到啦～我目前只会本地预设回应，可以试试「跳一下」「睡觉」或「提醒我」。'

    def open_chat(self):
        if self.dialog and self.dialog.winfo_exists():
            self.dialog.lift()
            return
        self.bubble.withdraw()
        self.dialog = tk.Toplevel(self.root)
        d = self.dialog
        d.title('糯糯 · Strip Bot')
        d.configure(bg='#fffafa')
        d.attributes('-topmost', self.top.get())
        d.resizable(False, False)
        try:
            d.iconbitmap(str(BASE/'nono.ico'))
        except tk.TclError:
            pass
        tk.Label(d, text='使用 Strip Bot 已保存的 API 模型 · 对话仅保留在本次宠物运行中', bg='#fffafa', fg='#94828b', font=FONT).pack(padx=18, pady=(16, 10))
        response = tk.StringVar(value='输入问题后发送。跳跃、睡觉和提醒可通过右键菜单操作。')
        tk.Label(d, textvariable=response, bg='#fffafa', fg='#94828b', font=FONT, wraplength=400, justify='left').pack(padx=18)
        transcript = tk.Text(d, width=52, height=14, wrap='word', bg='#fffafa', fg='#63545f', font=FONT, relief='flat')
        transcript.pack(padx=18, pady=10)
        def append(role, text):
            transcript.configure(state='normal')
            transcript.insert('end', role + '：' + text + '\n\n')
            transcript.see('end')
            transcript.configure(state='disabled')
        for message in self.history:
            append('你' if message['role'] == 'user' else '糯糯', message['content'])
        transcript.configure(state='disabled')
        row = tk.Frame(d, bg='#fffafa')
        row.pack(fill='x', padx=18, pady=(8, 18))
        entry = tk.Entry(row, font=FONT, width=25)
        entry.pack(side='left', fill='x', expand=True, ipady=5)
        def submit(event=None):
            text = entry.get().strip()
            if not text or self.network_busy:
                return
            if len(text) > 4000:
                response.set('请输入 4000 字以内的问题。')
                return
            self.network_busy = True
            button.configure(state='disabled')
            response.set('正在等待模型回复…')
            messages = self.history[-20:] + [{'role': 'user', 'content': text}]
            def finish(result):
                self.network_busy = False
                ok, value = result
                if ok:
                    self.history = (messages + [{'role': 'assistant', 'content': value['text'][:4000]}])[-20:]
                if not d.winfo_exists():
                    return
                button.configure(state='normal')
                if ok:
                    append('你', text)
                    append('糯糯', value['text'])
                    entry.delete(0, 'end')
                    response.set('当前模型：' + value.get('model', ''))
                else:
                    response.set(value)
            def work():
                try:
                    result = (True, self.client.chat(messages))
                except Exception as error:
                    result = (False, str(error))
                self.results.put((finish, result))
            threading.Thread(target=work, daemon=True).start()
        button = tk.Button(row, text='发送', command=submit, font=FONT)
        button.pack(side='left', padx=(8,0))
        entry.bind('<Return>', submit)
        d.bind('<Escape>', lambda e: d.destroy())
        d.update_idletasks()
        l,t,r,b = primary_workarea(self.root)
        x = max(l+10, min(self.root.winfo_x(), r-d.winfo_reqwidth()-10))
        y = max(t+10, min(self.root.winfo_y()-d.winfo_reqheight()-12, b-d.winfo_reqheight()-10))
        d.geometry(f'+{x}+{y}')
        entry.focus_set()

    def close(self):
        if self.closed:
            return
        self.closed = True
        self.shutdown.set()
        try:
            self.settings_path.parent.mkdir(parents=True, exist_ok=True)
            self.settings_path.write_text(json.dumps({'size':self.size, 'topmost':self.top.get(), 'motion':self.motion.get()}), encoding='utf-8')
        except OSError:
            pass
        self.root.destroy()

def main():
    sizes = validate_assets()
    if '--check' in sys.argv:
        print('Asset check passed: 12 PNG frames and size metadata.')
        return
    if sys.platform != 'win32':
        raise SystemExit('This desktop build targets Windows. It does not support macOS/Linux transparency.')
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass
    global tk, messagebox
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    try:
        Nono(root, sizes)
        root.mainloop()
    except Exception as error:
        try:
            messagebox.showerror('糯糯启动失败', str(error), parent=root)
        except Exception:
            pass
        raise

if __name__ == '__main__':
    main()
