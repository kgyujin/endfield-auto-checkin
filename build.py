import os
import subprocess
import sys
import shutil

def install_dependencies():
    packages = ["pyinstaller"]
    for package in packages:
        try:
            __import__(package)
            print(f"{package} is already installed.")
        except ImportError:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def verify_icon():
    """Verify icon.ico exists and is valid"""
    icon_file = "icon.ico"
    if not os.path.exists(icon_file):
        print(f"ERROR: {icon_file} not found!")
        print("Please place your icon.ico file in the directory.")
        return False
    
    size = os.path.getsize(icon_file)
    if size < 100:
        print(f"WARNING: {icon_file} seems too small ({size} bytes)")
        return False
    
    print(f"Icon file verified: {icon_file} ({size} bytes)")
    return True

def build_exe():
    print("Building updater.exe...")
    
    if not verify_icon():
        return

    try:
        icon_path = os.path.abspath("icon.ico")
        
        cmd = [
            "pyinstaller",
            "--noconsole",
            "--onefile",
            "--name", "updater",
            "--clean",
            f"--icon={icon_path}",
            f"--add-data={icon_path};.",
            "updater.py"
        ]
        
        print(f"Using icon: {icon_path}")
        subprocess.check_call(cmd)
        
        print("\nBuild Successful!")
        print(f"Executable is located at: {os.path.abspath('dist/updater.exe')}")
        
    except subprocess.CalledProcessError as e:
        print(f"Build Failed: {e}")

def cleanup():
    print("Cleaning up build artifacts...")
    if os.path.exists("build"):
        shutil.rmtree("build")
    if os.path.exists("updater.spec"):
        os.remove("updater.spec")
    
    if os.path.exists("dist/updater.exe"):
        if os.path.exists("updater.exe"):
            os.remove("updater.exe")
        shutil.move("dist/updater.exe", "updater.exe")
        shutil.rmtree("dist")
        print("Moved updater.exe to root directory.")
        print("\nNOTE: Windows may cache icon thumbnails.")
        print("If the icon doesn't appear immediately, try:")
        print("1. Refresh the folder (F5)")
        print("2. Clear icon cache: Delete IconCache.db from %localappdata%")
        print("3. Restart Windows Explorer")

if __name__ == "__main__":
    install_dependencies()
    build_exe()
    cleanup()
    input("\nPress Enter to exit...")
