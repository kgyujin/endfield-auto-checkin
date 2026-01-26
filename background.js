/**
 * Endfield Auto Check-in - Refactored (Hybrid Logic)
 * Based on original 'ref' structure + New Signature Logic
 */

const TARGET_DOMAINS = ["skport.com", "game.skport.com", "gryphline.com"];
const ALARM_NAME = "dailyCheckIn";

class AccountStore {
    async get(key) {
        const data = await chrome.storage.local.get([key]);
        return data[key];
    }
    async set(key, value) {
        return chrome.storage.local.set({ [key]: value });
    }

    async addLog(status, message) {
        let logs = (await this.get('checkInLogs')) || [];
        const now = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        logs.unshift({ date: now, status: status, msg: message });
        if (logs.length > 50) logs = logs.slice(0, 50);
        await this.set('checkInLogs', logs);
    }

    async saveAccount(info) { await this.set('accountInfo', info); }
    async getAccount() { return await this.get('accountInfo'); }
    async isAutoRunActive() { return (await this.get('isGlobalActive')) !== false; }

    async saveResult(status, date, time) {
        const uiStatus = (status === "ALREADY_DONE") ? "SUCCESS" : status;
        await this.set('lastStatus', uiStatus);
        await this.set('lastCheckDate', date);
        await this.set('lastCheckTime', time);
        await this.set('isRunning', false);
    }

    async getDeviceId() {
        let dId = await this.get('dId');
        if (!dId) {
            dId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            await this.set('dId', dId);
        }
        return dId;
    }
}

class CheckInService {
    constructor(store) { this.store = store; }

    getServerTodayString() {
        const now = new Date();
        const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
        return utc8Time.toISOString().split('T')[0];
    }

    async getHeaders(cred, role) {
        // Headers matching the user provided snippet
        const headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en", // Snippet uses 'en', let's stick to it or flexible
            "origin": "https://game.skport.com",
            "referer": "https://game.skport.com/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
            "platform": "3",
            "vname": "1.0.0",
            "sk-language": "en"
        };

        if (cred) headers["cred"] = cred;
        // sk-game-role is added dynamically in requests where needed
        return headers;
    }

    async getAllCookies() {
        let allCookies = [];
        for (const domain of TARGET_DOMAINS) {
            try {
                const cookies = await chrome.cookies.getAll({ domain: domain });
                allCookies = allCookies.concat(cookies);
            } catch (e) { }
        }
        return allCookies;
    }

    findCredInCookies(cookies) {
        // Priority: SK_OAUTH_CRED_KEY -> cred -> sk_cred
        const targets = ['SK_OAUTH_CRED_KEY', 'cred', 'sk_cred'];
        for (const t of targets) {
            const found = cookies.find(c => c.name === t);
            if (found && found.value) return found.value;
        }
        return null;
    }

    async fetchGameRole(cred) {
        try {
            const headers = await this.getHeaders(cred, null);
            // Snippet uses gameId=3
            const url = "https://zonai.skport.com/api/v1/game/player/binding?gameId=3";
            // Note: snippet uses 'muteHttpExceptions: true', here we handle via fetch

            const response = await fetch(url, {
                method: "GET",
                headers: headers
            });
            const data = await response.json();

            if (data.code === 0 && data.data?.list?.[0]?.bindingList?.[0]?.roles?.[0]) {
                const roleData = data.data.list[0].bindingList[0].roles[0];
                // Snippet Format: 3_roleId_serverId
                return `3_${roleData.roleId}_${roleData.serverId}`;
            }
            return null;
        } catch (e) {
            console.error("Fetch Role Error:", e);
            return null;
        }
    }

    async syncAccountData(localStorageData) {
        try {
            const cookies = await this.getAllCookies();
            let cred = localStorageData?.cred || this.findCredInCookies(cookies);

            if (!cred) {
                throw new Error("로그인 정보를 찾을 수 없습니다.\n사이트에 로그인되어 있는지 확인해주세요.");
            }

            // Cleanup cred if needed
            if (cred) {
                cred = decodeURIComponent(cred).replace(/^"|"$/g, '');
            }

            // Always try to fetch fresh role first with new cred
            let role = await this.fetchGameRole(cred);

            // Fallback to local storage or known role only if fetch fails? 
            // Actually snippet relies on fresh fetch. Let's trust fetch.

            if (!role && localStorageData?.role) {
                role = localStorageData.role;
            }

            if (!role) {
                console.warn("캐릭터 정보(Role)를 찾지 못했습니다. (연동은 진행)");
            }

            const accountInfo = {
                uid: "Linked",
                cred: cred,
                role: role || "",
                cookies: cookies, // Storing cookies might be redundant if we just use them for finding cred, but keeping for debug
                lastSync: new Date().toLocaleString('ko-KR')
            };

            await this.store.saveAccount(accountInfo);
            return { code: "SUCCESS", data: accountInfo };

        } catch (e) {
            return { code: "FAIL", msg: e.message };
        }
    }

    async executeAttendance() {
        try {
            const account = await this.store.getAccount();
            if (!account || !account.cred) return { code: "NOT_LOGGED_IN", msg: "계정 연동 필요" };

            // Ensure we have a role. If missing, try to fetch it again 
            // (e.g. if it wasn't found during sync but might work now)
            let role = account.role;
            if (!role) {
                role = await this.fetchGameRole(account.cred);
                if (role) {
                    account.role = role;
                    await this.store.saveAccount(account);
                }
            }

            if (!role) {
                return { code: "FAIL", msg: "Character binding not found." };
            }

            // --- Simplified Flow from Snippet ---
            const url = "https://zonai.skport.com/web/v1/game/endfield/attendance";
            const commonHeaders = await this.getHeaders(account.cred, null);
            const headers = { ...commonHeaders, "sk-game-role": role };

            // 1. Check Status
            const checkRes = await fetch(url, { method: "GET", headers: headers });
            const checkData = await checkRes.json();

            if (checkData.code === 0 && checkData.data?.hasToday) {
                return { code: "ALREADY_DONE", msg: "이미 완료됨", rawData: checkData };
            }

            // 2. Post Attendance
            const postRes = await fetch(url, {
                method: "POST",
                headers: { ...headers, "content-type": "application/json" },
                body: JSON.stringify({})
            });
            const postData = await postRes.json();

            // 3. Final Check (Optional for status return, but snippet does it)
            // We can just rely on POST result
            if (postData.code === 0 || postData.code === 10001) {
                return { code: "SUCCESS", msg: "출석 성공", rawData: postData };
            } else {
                return { code: "FAIL", msg: postData.message || "Unknown error", rawData: postData };
            }

        } catch (e) {
            return { code: "ERROR", msg: e.message };
        }
    }
}

class CheckInController {
    constructor() {
        this.store = new AccountStore();
        this.service = new CheckInService(this.store);
    }
    init() {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === ALARM_NAME) this.run(false);
        });

        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === "manualRun") {
                this.run(true);
            }
            else if (msg.action === "syncAccount") {
                this.service.syncAccountData(msg.storageData).then(async res => {
                    if (res.code === "SUCCESS") {
                        this.store.addLog("SYNC", "계정 연동 성공");
                        const result = await this.service.executeAttendance();
                        this.handleResult(result);
                    }
                    else this.store.addLog("ERROR", res.msg);
                    sendResponse(res);
                });
                return true;
            }
            else if (msg.action === "logout") {
                this.store.set('accountInfo', null).then(() => {
                    this.store.addLog("LOGOUT", "연동 해제");
                    sendResponse({ code: "SUCCESS" });
                });
                return true;
            }
            else if (msg.action === "resetData") {
                this.resetAllData().then(() => {
                    sendResponse({ code: "SUCCESS" });
                });
                return true;
            }
        });

        this.run(false);
    }

    async run(force) {
        const isActive = await this.store.isAutoRunActive();
        if (!force && !isActive) { this.clearBadge(); return; }

        const lastDate = await this.store.get('lastCheckDate');
        const serverToday = this.service.getServerTodayString();
        const lastStatus = await this.store.get('lastStatus');

        if (!force && lastDate === serverToday && lastStatus === "SUCCESS") {
            this.clearBadge(); return;
        }

        await this.store.set('isRunning', true);
        const result = await this.service.executeAttendance();
        this.handleResult(result);
    }

    async handleResult(result) {
        const serverToday = this.service.getServerTodayString();
        const timeString = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        await this.store.addLog(result.code, result.msg);

        if (result.code === "SUCCESS" || result.code === "ALREADY_DONE") {
            this.clearBadge();
            await this.store.saveResult("SUCCESS", serverToday, timeString);
        } else {
            this.setBadgeX();
            await this.store.saveResult("FAIL", serverToday, timeString);
        }
    }

    clearBadge() { chrome.action.setBadgeText({ text: "" }); }
    setBadgeX() { chrome.action.setBadgeText({ text: "X" }); chrome.action.setBadgeBackgroundColor({ color: "#FF3B30" }); }

    async resetAllData() {
        await chrome.storage.local.clear();
        for (const domain of TARGET_DOMAINS) {
            try {
                const cookies = await chrome.cookies.getAll({ domain: domain });
                for (const cookie of cookies) {
                    const protocol = cookie.secure ? "https:" : "http:";
                    let domain = cookie.domain;
                    if (domain.startsWith('.')) domain = domain.substring(1);
                    const url = `${protocol}//${domain}${cookie.path}`;
                    await chrome.cookies.remove({ url: url, name: cookie.name, storeId: cookie.storeId });
                }
            } catch (e) { }
        }
        this.clearBadge();
    }
}

const controller = new CheckInController();
controller.init();