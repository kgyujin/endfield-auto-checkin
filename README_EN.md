# Endfield Auto Check-in

[🇰🇷 Korean Version](./README.md)

**Arknights: Endfield (SKPORT) Daily Check-in Automation Extension**

Endfield Auto Check-in is a Chromium-based browser extension that  
automatically performs the daily check-in for  
**Arknights: Endfield (SKPORT)** in the background while the user is logged in.

---

## Overview

| Item | Description |
|---|---|
| Platform | Chromium-based browsers (Chrome, Edge, Whale, etc.) |
| Version | 10.0 (Invisible Mode & Smart Schedule) |
| Requirement | User must be logged in to the SKPORT website |
| Execution | Local browser automation |
| External Network | None |

---

## Key Features

### Invisible Auto Check-in
- Automatically performs daily check-in on browser startup
- Runs silently without blocking or covering the screen

### Smart Scheduling
- Determines execution based on the game server reset time (UTC+8 00:00)
- Skips execution if the daily check-in is already completed

### Status Badge
- Displays execution status via the extension icon  
  - `O or no badge` : Check-in completed  
  - `X` : Login required or execution failed

### Login Detection
- Automatically stops execution if the user is not logged in
- Notifies the user instead of force-opening pages

---

## Installation (Manual)

1. Select **Code → Download ZIP** from this repository
2. Extract the downloaded archive
3. Open `chrome://extensions` in the browser
4. Enable **Developer mode**
5. Click **Load unpacked** and select the extracted folder

---

## Usage

1. Log in once to the Arknights: Endfield check-in page on SKPORT
2. The extension will automatically perform the daily check-in on browser startup
3. Click the extension icon to check status or run immediately using `CHECK NOW`

---

## Architecture (For Developers)

This project follows a layered architecture for maintainability and extensibility.

- **Controller**  
  Controls overall workflow and scheduling
- **Service**  
  Business logic such as date calculation and execution checks
- **Store**  
  Local persistence using `chrome.storage`
- **Runner**  
  DOM interaction and window execution management

---

## License

MIT License
