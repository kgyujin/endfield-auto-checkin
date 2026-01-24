# Endfield Auto Check-in

[![한국어](https://img.shields.io/badge/Language-한국어-green?style=flat-square)](README.md)
[![Version](https://img.shields.io/badge/version-10.0-blue?style=flat-square&logo=google-chrome&logoColor=white)](https://github.com/kgyujin/auto-daily-checkin/releases)
[![Platform](https://img.shields.io/badge/platform-Chromium-important?style=flat-square&logo=google-chrome&logoColor=white)](https://www.google.com/chrome/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

A high-performance Chrome extension that automatically performs daily check-ins for **Arknights: Endfield (SKPORT)** in the background.

| Item | Details |
| --- | -------- |
| **Platform** | Chromium-based browsers (Chrome, Edge, Whale, Brave, etc.) |
| **Version** | 10.0 (Invisible Mode & Smart Schedule) |
| **Prerequisite** | Must be **logged in** to the game website |

## ✨ Key Features

- **Invisible Automation**: Runs silently in the background when the browser starts. The process creates a minimized window that does not disrupt your screen or workflow.
- **Smart Scheduling**: Calculates the game server reset time (UTC+8 00:00) to prevent redundant executions. If you've already checked in today, it stays idle.
- **Status Badges**: The extension icon displays `O` (Success/Done) or `X` (Login Required/Fail) to indicate status at a glance.
- **Cookie Detection**: Smartly detects login status via cookies. If logged out, it sends a notification instead of opening unnecessary windows.

## 🚀 Installation Guide

1. **Download**: Click `[Code] -> [Download ZIP]` on this repository and unzip the file.
2. **Extensions Page**: Open your browser and go to `chrome://extensions`.
3. **Developer Mode**: Toggle the switch at the top right corner to **ON**.
4. **Load**: Click `[Load unpacked]` and select the unzipped folder.

## 📖 How to Use

1. **Login**: Log in once at the [SKPORT Endfield Check-in Page](https://game.skport.com/endfield/sign-in).
2. **Auto Run**: Just keep your browser open. The extension handles the rest.
3. **Manual Check**: Click the extension icon to view details or click the `CHECK NOW` button to force a check-in.

## 🏗️ Architecture (For Developers)

This project follows a layered architecture for scalability and maintenance:
- **Controller**: Manages the overall flow and alarm scheduling.
- **Service**: Handles business logic (date calculation, execution validation).
- **Store**: Manages data persistence using `chrome.storage`.
- **Runner**: Handles DOM manipulation and invisible window management.

## 📝 License
MIT License.