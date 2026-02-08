import os
import sys
import json
import shutil
import urllib.request
import zipfile
import tkinter as tk
from tkinter import messagebox, ttk
import threading
import tempfile
import time
import ctypes

# Configuration
REPO_OWNER = "kgyujin"
REPO_NAME = "endfield-auto-checkin"
GITHUB_API_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"

def get_base_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

CURRENT_DIR = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
MANIFEST_FILE = os.path.join(CURRENT_DIR, "manifest.json")
ICON_ICO_PATH = os.path.join(get_base_path(), "icon.ico")
ICON_PNG_PATH = os.path.join(get_base_path(), "icon.png")

# Enable High DPI support
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except:
    pass

class ModernPopupUpdater(tk.Tk):
    def __init__(self):
        super().__init__()

        # Window Setup
        self.overrideredirect(True)
        self.geometry("420x260")
        self.configure(bg="#0F0F0F")
        
        # Main Container with subtle shadow effect
        self.main_frame = tk.Frame(self, bg="#1A1A1A", highlightbackground="#2A2A2A", highlightthickness=1)
        self.main_frame.pack(fill="both", expand=True, padx=3, pady=3)
        
        # Title Bar
        self.title_bar = tk.Frame(self.main_frame, bg="#1A1A1A", height=50)
        self.title_bar.pack(fill="x", side="top")
        self.title_bar.pack_propagate(False)
        
        # Make draggable
        self.title_bar.bind("<Button-1>", self.start_move)
        self.title_bar.bind("<B1-Motion>", self.do_move)
        
        # Title with icon-like emoji
        title_container = tk.Frame(self.title_bar, bg="#1A1A1A")
        title_container.pack(expand=True)
        
        self.lbl_title = tk.Label(title_container, text="⚡ Endfield Auto Check-in", 
                                 font=("Pretendard", 13, "bold"), bg="#1A1A1A", fg="#D4D94A")
        self.lbl_title.pack()
        self.lbl_title.bind("<Button-1>", self.start_move)
        self.lbl_title.bind("<B1-Motion>", self.do_move)
        
        # Separator line
        separator = tk.Frame(self.main_frame, bg="#2A2A2A", height=1)
        separator.pack(fill="x", padx=20)
        
        # Set Icon
        try:
            if os.path.exists(ICON_ICO_PATH):
                self.iconbitmap(ICON_ICO_PATH)
            elif os.path.exists(ICON_PNG_PATH):
                img = tk.PhotoImage(file=ICON_PNG_PATH)
                self.iconphoto(True, img)
        except:
            pass
        
        # Center Window
        self.center_window(420, 260)

        # Content Area
        self.content_frame = tk.Frame(self.main_frame, bg="#1A1A1A")
        self.content_frame.pack(fill="both", expand=True, padx=30, pady=20)

        # Status Label
        self.lbl_status = tk.Label(self.content_frame, text="Checking for updates...", 
                                  font=("Pretendard", 11), bg="#1A1A1A", fg="#CCCCCC", 
                                  wraplength=350, justify="center")
        self.lbl_status.pack(pady=(10, 20))

        # Progress Bar with modern style
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("Modern.Horizontal.TProgressbar", 
                       background="#D4D94A", 
                       troughcolor="#2A2A2A", 
                       bordercolor="#1A1A1A",
                       lightcolor="#D4D94A", 
                       darkcolor="#D4D94A",
                       thickness=6)
        
        self.progress = ttk.Progressbar(self.content_frame, orient="horizontal", 
                                       length=360, mode="indeterminate", 
                                       style="Modern.Horizontal.TProgressbar")
        self.progress.pack(pady=(0, 25))

        # Close Button - Using standard button for reliability
        self.btn_close = tk.Button(
            self.content_frame, 
            text="Close", 
            command=self.close_app,
            font=("Pretendard", 10, "bold"),
            bg="#2A2A2A",
            fg="#888888",
            activebackground="#333333",
            activeforeground="#AAAAAA",
            relief="flat",
            bd=0,
            padx=40,
            pady=10,
            cursor="hand2",
            state="disabled"
        )
        self.btn_close.pack()
        
        # Hover effects
        self.btn_close.bind("<Enter>", self.on_button_enter)
        self.btn_close.bind("<Leave>", self.on_button_leave)

        # Start update
        self.update_in_progress = True
        self.thread = threading.Thread(target=self.check_and_update, daemon=True)
        self.thread.start()
    
    def on_button_enter(self, e):
        if str(self.btn_close['state']) == 'normal':
            current_bg = str(self.btn_close['bg'])
            if current_bg == "#D4D94A" or current_bg == "#d4d94a":
                self.btn_close.config(bg="#E6EB5C")
            elif current_bg == "#FF6B6B" or current_bg == "#ff6b6b":
                self.btn_close.config(bg="#FF8787")
            else:
                self.btn_close.config(bg="#333333")
    
    def on_button_leave(self, e):
        if str(self.btn_close['state']) == 'normal':
            current_bg = str(self.btn_close['bg'])
            if current_bg == "#E6EB5C" or current_bg == "#e6eb5c":
                self.btn_close.config(bg="#D4D94A")
            elif current_bg == "#FF8787" or current_bg == "#ff8787":
                self.btn_close.config(bg="#FF6B6B")
            else:
                self.btn_close.config(bg="#2A2A2A")

    def start_move(self, event):
        self.x = event.x_root
        self.y = event.y_root

    def do_move(self, event):
        deltax = event.x_root - self.x
        deltay = event.y_root - self.y
        x = self.winfo_x() + deltax
        y = self.winfo_y() + deltay
        self.geometry(f"+{x}+{y}")
        self.x = event.x_root
        self.y = event.y_root

    def center_window(self, w, h):
        self.update_idletasks()
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width - w) // 2
        y = (screen_height - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")

    def close_app(self):
        self.destroy()
        sys.exit(0)

    def update_status(self, message, is_error=False, is_success=False, show_completion_popup=False):
        self.after(0, lambda: self._update_status_ui(message, is_error, is_success, show_completion_popup))

    def _update_status_ui(self, message, is_error, is_success, show_completion_popup):
        # Update text and color
        if is_error:
            self.lbl_status.config(text=message, fg="#FF6B6B")
        elif is_success:
            self.lbl_status.config(text=message, fg="#51CF66")
        else:
            self.lbl_status.config(text=message, fg="#CCCCCC")

        # Handle completion
        if is_error or is_success or "Up to date" in message:
            self.progress.stop()
            self.progress.pack_forget()
            
            self.update_in_progress = False
            
            # Enable and style button
            self.btn_close.config(state="normal")
            
            if is_success or "Up to date" in message:
                self.btn_close.config(bg="#D4D94A", fg="#1A1A1A", activebackground="#E6EB5C", activeforeground="#1A1A1A")
            else:
                self.btn_close.config(bg="#FF6B6B", fg="white", activebackground="#FF8787", activeforeground="white")
            
            # Only show popup and auto-close for actual updates, not for "already up to date"
            if show_completion_popup:
                self.after(1000, lambda: messagebox.showinfo("Success", "Update Completed!"))
                self.after(1500, self.close_app)

    def get_current_version(self):
        if not os.path.exists(MANIFEST_FILE):
            return "0.0.0"
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("version", "0.0.0")
        except:
            return "0.0.0"

    def check_and_update(self):
        try:
            self.progress.start(10)
            
            current_version = self.get_current_version()
            time.sleep(0.5)
            self.update_status(f"Current: v{current_version}  •  Checking GitHub...")

            req = urllib.request.Request(GITHUB_API_URL)
            req.add_header("User-Agent", "Endfield-Updater")
            
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                
            latest_version = data["tag_name"].replace("v", "")
            zip_url = data["zipball_url"]
            
            if self.compare_versions(current_version, latest_version) >= 0:
                self.update_status("✓ You are already up to date", is_success=True)
                return

            self.update_status(f"New version found: v{latest_version}")
            time.sleep(1)

            self.update_status(f"⬇ Downloading v{latest_version}...")
            
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, "update.zip")
                urllib.request.urlretrieve(zip_url, zip_path)
                
                self.update_status("📦 Extracting files...")
                extract_dir = os.path.join(temp_dir, "extracted")
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                
                extracted_items = os.listdir(extract_dir)
                if not extracted_items:
                    raise Exception("Empty update package")
                
                source_folder = os.path.join(extract_dir, extracted_items[0])
                
                self.update_status("⚙ Installing updates...")
                time.sleep(0.5)
                
                for item in os.listdir(source_folder):
                    s = os.path.join(source_folder, item)
                    d = os.path.join(CURRENT_DIR, item)
                    
                    if item.lower() == "updater.exe":
                        continue
                        
                    if os.path.isdir(s):
                        if os.path.exists(d):
                            shutil.rmtree(d)
                        shutil.copytree(s, d)
                    else:
                        shutil.copy2(s, d)
            
            self.update_status("✓ Update Complete!", is_success=True, show_completion_popup=True)

        except Exception as e:
            self.update_status(f"✗ Error: {str(e)}", is_error=True)

    def compare_versions(self, v1, v2):
        p1 = list(map(int, v1.split('.')))
        p2 = list(map(int, v2.split('.')))
        return (p1 > p2) - (p1 < p2)

if __name__ == "__main__":
    app = ModernPopupUpdater()
    app.mainloop()
