/**
 * Endfield Auto Check-in v13.4
 */

const API_ENDPOINT = "https://zonai.skport.com/web/v1/game/endfield/attendance";
const REFERER_URL = "https://game.skport.com/";
const COOKIE_DOMAIN = "skport.com";
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
        // 날짜: 1. 24. 12:30
        const now = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        
        logs.unshift({ date: now, status: status, msg: message });
        
        if (logs.length > 3) logs = logs.slice(0, 3);
        
        await this.set('checkInLogs', logs);
    }

    async saveAccount(info) { await this.set('accountInfo', info); }
    async getAccount() { return await this.get('accountInfo'); }
    async isAutoRunActive() { return (await this.get('isGlobalActive')) !== false; }

    async saveResult(status, date, time) {
        await this.set('lastStatus', status);
        await this.set('lastCheckDate', date);
        await this.set('lastCheckTime', time);
        await this.set('isRunning', false); // 실행 종료
    }
}

class CheckInService {
    constructor(store) { this.store = store; }

    getServerTodayString() {
        const now = new Date();
        const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
        return utc8Time.toISOString().split('T')[0];
    }

    async getHeaders(method) {
        const account = await this.store.getAccount();
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "ko,ko-KR;q=0.9,en-US;q=0.8,en;q=0.7",
            "Origin": "https://game.skport.com",
            "Referer": REFERER_URL,
            "Sec-Ch-Ua": "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\"",
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": "\"macOS\"",
            "User-Agent": navigator.userAgent,
            "Platform": "3",
            "Vname": "1.0.0",
            "Sk-Language": "ko",
            "Timestamp": timestamp
        };

        if (method === "POST") headers["Content-Type"] = "application/json";
        
        // 인증 정보
        if (account) {
            if (account.cred) headers["cred"] = account.cred;
            if (account.role) headers["sk-game-role"] = account.role;
        }

        return headers;
    }

    async fetchWithRetry(url, options, retries = 1) {
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.status === 401) throw new Error("401 Unauthorized");
                if (response.ok) return response;
                throw new Error(`HTTP ${response.status}`);
            } catch (err) {
                if (i === retries) throw err;
                await new Promise(r => setTimeout(r, 1000)); 
            }
        }
    }

    // 쿠키에서 cred 찾기 (2차 방어선)
    async findCredFromCookies() {
        const cookies = await chrome.cookies.getAll({ domain: COOKIE_DOMAIN });
        if (cookies) {
            const credCookie = cookies.find(c => c.name === 'cred' || c.name === 'sk_cred');
            if (credCookie) return credCookie.value;
        }
        return null;
    }

    // role 정보 API로 조회
    async fetchGameRole(cred) {
        try {
            const headers = await this.getHeaders("GET");
            headers["cred"] = cred; // 임시 주입
            
            const url = `https://zonai.skport.com/api/v1/game/player/binding?gameId=3`; 
            const response = await this.fetchWithRetry(url, {
                method: "GET", headers: headers, credentials: "include"
            });
            const data = await response.json();

            if (data.code === 0 && data.data?.list?.[0]?.bindingList?.[0]?.roles?.[0]) {
                const roleData = data.data.list[0].bindingList[0].roles[0];
                // role format: 3_{roleId}_{serverId}
                return `3_${roleData.roleId}_${roleData.serverId}`;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    async syncAccountData(syncData) {
        try {
            let cred = syncData?.cred;
            let role = syncData?.role;

            // 1. cred 없으면 쿠키 탐색
            if (!cred) {
                cred = await this.findCredFromCookies();
                if (!cred) throw new Error("로그인 정보(cred) 없음. 로그인해주세요.");
            }

            // 2. role 없으면 API 조회
            if (!role) {
                role = await this.fetchGameRole(cred);
                if (!role) throw new Error("캐릭터 정보(Role) 조회 실패.");
            }

            // 3. API 테스트
            const headers = await this.getHeaders("GET");
            headers["cred"] = cred;
            headers["sk-game-role"] = role;

            const response = await this.fetchWithRetry(API_ENDPOINT, {
                method: "GET", headers: headers, credentials: "include"
            });
            
            if (!response.ok) throw new Error("API 테스트 실패");

            const accountInfo = {
                uid: "Linked",
                cred: cred,
                role: role,
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
            if (!account || !account.cred || !account.role) return { code: "FAIL", msg: "계정 연동 필요" };

            // 1. GET (상태 확인)
            const getHeaders = await this.getHeaders("GET");
            const getRes = await this.fetchWithRetry(API_ENDPOINT, {
                method: "GET", headers: getHeaders, credentials: "include"
            });
            const getData = await getRes.json();

            if (getData.code === 0 && getData.data && getData.data.hasToday) {
                 return { code: "ALREADY_DONE", msg: "이미 완료됨" };
            }

            // 2. POST (출석)
            const postHeaders = await this.getHeaders("POST");
            const postRes = await this.fetchWithRetry(API_ENDPOINT, {
                method: "POST", headers: postHeaders, credentials: "include", body: JSON.stringify({})
            });
            const postData = await postRes.json();

            if (postData.code === 0 || postData.message === "OK") {
                return { code: "SUCCESS", msg: "출석 성공" };
            } else if (postData.code === 10001) {
                return { code: "ALREADY_DONE", msg: "이미 완료됨" };
            } else {
                return { code: "FAIL", msg: postData.message || "오류" };
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
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === ALARM_NAME) this.run(false);
        });
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === "manualRun") this.run(true);
            else if (msg.action === "syncAccount") {
                this.service.syncAccountData(msg.data).then(res => {
                    if(res.code === "SUCCESS") this.store.addLog("SYNC", "계정 연동 성공");
                    else this.store.addLog("ERROR", res.msg);
                    sendResponse(res);
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

        // [수정] SUCCESS 상태면 스킵 (ALREADY_DONE도 SUCCESS로 저장됨)
        if (!force && lastDate === serverToday && lastStatus === "SUCCESS") {
            this.clearBadge(); return;
        }

        // 실행 중 표시
        await this.store.set('isRunning', true);
        
        const result = await this.service.executeAttendance();
        this.handleResult(result);
    }

    async handleResult(result) {
        const serverToday = this.service.getServerTodayString();
        const timeString = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        // 상세 로그는 그대로 저장 (SUCCESS / ALREADY_DONE 구분)
        await this.store.addLog(result.code, result.msg);

        // [핵심] 상태 저장 시에는 "ALREADY_DONE"을 "SUCCESS"로 통합하여 UI 혼동 방지
        let finalStatus = result.code;
        if (result.code === "ALREADY_DONE") finalStatus = "SUCCESS";

        if (finalStatus === "SUCCESS") {
            this.clearBadge();
            await this.store.saveResult("SUCCESS", serverToday, timeString);
            
            if (result.code === "SUCCESS") this.notify("출석 완료", "보상 지급됨");
        } else {
            this.setBadgeX();
            await this.store.saveResult("FAIL", serverToday, timeString);
            
            if (result.msg.includes("401") || result.code === "NOT_LOGGED_IN") {
                 this.notify("인증 만료", "계정 연동을 다시 해주세요.");
            }
        }
    }

    clearBadge() { chrome.action.setBadgeText({ text: "" }); }
    setBadgeX() { chrome.action.setBadgeText({ text: "X" }); chrome.action.setBadgeBackgroundColor({ color: "#FF3B30" }); }
    notify(title, msg) {
        chrome.notifications.create({ type: "basic", iconUrl: "icon.png", title: title, message: msg, priority: 1, silent: true });
    }
}

const controller = new CheckInController();
controller.init();