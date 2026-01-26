
importScripts('crypto_utils.js');

/**
 * Endfield Auto Check-in - Fixed & Signed
 */

// [Corrected API Endpoint based on analysis]
const API_ATTEND = "https://attendance.skport.com/api/v1/score/attendance";
const API_BINDING = "https://zonai.skport.com/api/v1/game/player/binding";
const REFERER_URL = "https://game.skport.com/";
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
        if (logs.length > 50) logs = logs.slice(0, 50); // Increased log size
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

    // [New] Device ID Management
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

    // [New] Signature Generation Logic
    async generateSignature(path, body, timestamp, headers, cred) {
        // s = path + body + timestamp + JSON.stringify(headers)
        // headers must include: platform, timestamp, dId, vName

        // Ensure accurate header object for signing
        const signHeaders = {
            platform: headers.platform,
            timestamp: headers.timestamp,
            dId: headers.dId,
            vName: headers.vName || "1.0.0"
        };

        const strHeaders = JSON.stringify(signHeaders);
        // If body is empty object string used in POST, use it. If GET, body is empty string.
        const content = path + body + timestamp + strHeaders;

        // HMAC-SHA256
        const hmac = await CryptoUtils.hmacSha256(content, cred);
        // MD5
        const sign = CryptoUtils.md5(hmac);

        return sign;
    }

    async getHeaders(method, cred, role, cookies = []) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const dId = await this.store.getDeviceId();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "ko,ko-KR;q=0.9,en-US;q=0.8,en;q=0.7",
            "origin": "https://game.skport.com",
            "referer": REFERER_URL,
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
            "platform": "3",
            "vname": "1.0.0",
            "dId": dId, // Added dId
            "sk-language": "ko",
            "timestamp": timestamp
        };

        if (cookieString) headers["cookie"] = cookieString;
        if (method === "POST") headers["content-type"] = "application/json";

        if (!cred || !role) {
            const account = await this.store.getAccount();
            if (account) {
                cred = cred || account.cred;
                role = role || account.role;
            }
        }

        if (cred) headers["cred"] = cred;
        // if (role) headers["sk-game-role"] = role; // Removed - usually not part of the sign headers check, but good to have if API needs it. 
        // Note: Analysis didn't explicitly show sk-game-role in sign headers, but it might be needed for binding.
        // Re-adding it as it's likely harmless or required for authentication context.
        if (role) headers["sk-game-role"] = role;

        return headers;
    }

    async fetchWithRetry(url, options, retries = 1) {
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(url, options);
                // 401 should propagate to handle re-login logic
                if (response.status === 401) throw new Error("401 Unauthorized");
                if (response.ok) return response;
                // If 204 or other success codes
                if (response.status === 204) return response;

                // Try reading body for error message
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            } catch (err) {
                if (i === retries) throw err;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
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
        const target = cookies.find(c => c.name === 'cred' || c.name === 'sk_cred');
        return target ? target.value : null;
    }

    async fetchGameRole(cred) {
        try {
            const cookies = await this.getAllCookies();
            const headers = await this.getHeaders("GET", cred, null, cookies);
            // Binding API might not need signing, but let's see. 
            // Usually binding API is just standard auth.
            const url = `${API_BINDING}?gameId=4`; // Changed to gameId=4 (Endfield) based on analysis

            const response = await this.fetchWithRetry(url, {
                method: "GET", headers: headers, credentials: "include"
            });
            const data = await response.json();

            if (data.code === 0 && data.data?.list?.[0]?.bindingList?.[0]?.roles?.[0]) {
                const roleData = data.data.list[0].bindingList[0].roles[0];
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

            let role = localStorageData?.role;
            if (!role) {
                role = await this.fetchGameRole(cred);
            }

            if (!role) {
                console.warn("캐릭터 정보(Role)를 찾지 못했습니다. (연동은 진행)");
            }

            // TEST API CALL
            // We use the Attendance API to verify
            // For verification, we just check headers generation, maybe a light call

            // To be safe, we skip a full API call here to avoid updating state, 
            // OR we call it and ignore result just to check 401.

            const accountInfo = {
                uid: "Linked",
                cred: cred,
                role: role || "",
                cookies: cookies,
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

            const cookies = await this.getAllCookies();

            // 1. GET (Check Status)
            // Note: GET requests also need signing typically in this API structure
            const getPath = "/api/v1/score/attendance"; // Relative path for signing
            const getHeaders = await this.getHeaders("GET", account.cred, account.role, cookies);

            // Sign GET request (query params included in path if any, here none)
            // body is empty string for GET
            // const signGet = await this.generateSignature(getPath, "", getHeaders.timestamp, getHeaders, account.cred);
            // getHeaders["sign"] = signGet;

            // Calling GET endpoint
            // const getRes = await this.fetchWithRetry(API_ATTEND, {
            //     method: "GET", headers: getHeaders, credentials: "include"
            // });
            // const getData = await getRes.json();
            // if (getData.code === 0 && getData.data && getData.data.hasToday) {
            //     return { code: "ALREADY_DONE", msg: "이미 완료됨" };
            // }
            // Skipping GET check for simplicity and robustness - just try to Sign-In (POST)

            // 2. POST (Attendance)
            const postPath = "/api/v1/score/attendance";
            const postBodyObj = {
                uid: account.uid === "Linked" ? undefined : account.uid, // Only send UID if explicitly known, otherwise internal logic uses token
                gameId: "4"
            };
            const postBody = JSON.stringify(postBodyObj);

            const postHeaders = await this.getHeaders("POST", account.cred, account.role, cookies);

            // GENERATE SIGNATURE
            const signature = await this.generateSignature(postPath, postBody, postHeaders.timestamp, postHeaders, account.cred);
            postHeaders["sign"] = signature;

            console.log("Signing Request:", { path: postPath, sign: signature, ts: postHeaders.timestamp });

            const postRes = await this.fetchWithRetry(API_ATTEND, {
                method: "POST", headers: postHeaders, credentials: "include", body: postBody
            });

            const postData = await postRes.json();

            if (postData.code === 0 || postData.message === "OK") {
                return { code: "SUCCESS", msg: "출석 성공" };
            } else if (postData.code === 10001) { // 10001 = Already checked in
                return { code: "ALREADY_DONE", msg: "이미 완료됨" };
            } else {
                return { code: "FAIL", msg: postData.message || `오류(${postData.code})` };
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
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 }); // Check every hour
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
                        // Attempt a check-in immediately after sync
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

        // Run on startup
        this.run(false);
    }

    async run(force) {
        const isActive = await this.store.isAutoRunActive();
        if (!force && !isActive) { this.clearBadge(); return; }

        const lastDate = await this.store.get('lastCheckDate');
        const serverToday = this.service.getServerTodayString();
        const lastStatus = await this.store.get('lastStatus');

        // If today already success, skip unless force
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
            } catch (e) { console.error(`Failed to clear cookies for ${domain}:`, e); }
        }
        this.clearBadge();
    }
}

const controller = new CheckInController();
controller.init();