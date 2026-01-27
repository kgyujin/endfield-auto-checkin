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
    async isAutoRunActive() { return true; }

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

    async getDiscordConfig() { return await this.get('discordConfig'); }
    async setDiscordConfig(config) { await this.set('discordConfig', config); }

    async addDiscordLog(status, message) {
        let logs = (await this.get('discordLogs')) || [];
        const now = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        logs.unshift({ date: now, status: status, msg: message });
        if (logs.length > 20) logs = logs.slice(0, 20);
        await this.set('discordLogs', logs);
    }

    async shouldSendDiscordNotification(serverDate) {
        const lastSent = await this.get('lastDiscordSentDate');
        return lastSent !== serverDate;
    }

    async markDiscordSent(serverDate) {
        await this.set('lastDiscordSentDate', serverDate);
    }

    async updateCredential(newCred, newCookies) {
        const info = await this.getAccount();
        if (info) {
            info.cred = newCred;
            if (newCookies) {
                info.cookies = newCookies;
            }
            info.lastSync = new Date().toLocaleString('ko-KR');
            await this.saveAccount(info);
            return true;
        }
        return false;
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
        const headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "origin": "https://game.skport.com",
            "referer": "https://game.skport.com/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "platform": "3",
            "sk-language": "ko"
        };

        if (cred) headers["cred"] = cred;
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
            const url = "https://zonai.skport.com/api/v1/game/player/binding?gameId=3";

            const response = await fetch(url, {
                method: "GET",
                headers: headers
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

    async refreshSession(cred) {
        try {
            const url = "https://game.skport.com/endfield/sign-in";
            await fetch(url, {
                method: "GET",
                headers: await this.getHeaders(cred, null)
            });
        } catch (e) {
            // Ignore errors for keep-alive
        }
    }

    async syncAccountData(localStorageData) {
        try {
            const cookies = await this.getAllCookies();
            let cred = localStorageData?.cred || this.findCredInCookies(cookies);

            if (!cred) {
                throw new Error("로그인 정보를 찾을 수 없습니다.\n사이트에 로그인되어 있는지 확인해주세요.");
            }

            if (cred) {
                cred = decodeURIComponent(cred).replace(/^"|"$/g, '');
            }

            let role = await this.fetchGameRole(cred);

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

            await this.refreshSession(account.cred);

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

class DiscordWebhookService {
    constructor(store) { this.store = store; }

    async sendAttendanceNotification(attendanceData, serverDate) {
        try {
            const config = await this.store.getDiscordConfig();

            if (!config || !config.webhookUrl) {
                return { code: "DISABLED", msg: "Discord notifications disabled" };
            }

            const shouldSend = await this.store.shouldSendDiscordNotification(serverDate);
            if (!shouldSend) {
                return { code: "ALREADY_SENT", msg: "Already sent today" };
            }

            const embed = this.formatAttendanceEmbed(attendanceData, serverDate);
            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });

            if (response.ok) {
                await this.store.markDiscordSent(serverDate);
                await this.store.addDiscordLog("SUCCESS", "출석 완료 알림 전송");
                return { code: "SUCCESS", msg: "Discord notification sent" };
            } else {
                const errorText = await response.text();
                await this.store.addDiscordLog("FAIL", `전송 실패: ${response.status}`);
                return { code: "FAIL", msg: `HTTP ${response.status}: ${errorText}` };
            }
        } catch (error) {
            await this.store.addDiscordLog("ERROR", error.message);
            return { code: "ERROR", msg: error.message };
        }
    }

    async sendErrorNotification(errorMsg) {
        try {
            const config = await this.store.getDiscordConfig();
            if (!config || !config.webhookUrl) {
                return;
            }

            const now = new Date();
            const kstTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
            const dateStr = kstTime.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
            const timeStr = kstTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

            const embed = {
                title: "⚠️ 엔드필드 출석 체크 실패",
                color: 16711680, // #FF0000 (red)
                fields: [
                    {
                        name: "📅 날짜",
                        value: dateStr,
                        inline: true
                    },
                    {
                        name: "🕐 시간",
                        value: timeStr,
                        inline: true
                    },
                    {
                        name: "❌ 오류 내용",
                        value: errorMsg,
                        inline: false
                    }
                ],
                footer: {
                    text: "Endfield Auto Check-in"
                },
                timestamp: now.toISOString()
            };

            await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        } catch (e) {
            console.error("Error sending error notification:", e);
        }
    }

    async sendAlreadyDoneNotification(result) {
        try {
            const config = await this.store.getDiscordConfig();
            if (!config || !config.webhookUrl) {
                return;
            }

            const now = new Date();
            // Calculate serverDate locally to match
            const kstTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
            const serverDate = kstTime.toISOString().split('T')[0];

            // Use shared format logic, overriding title and color
            const embed = this.formatAttendanceEmbed(result, serverDate, {
                title: "✅ 출석 체크 이미 완료됨",
                color: 3447003 // Blue
            });

            await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });

            await this.store.addDiscordLog("SUCCESS", "이미 완료됨 알림 전송");
        } catch (e) {
            console.error("Error sending already done notification:", e);
        }
    }

    formatAttendanceEmbed(data, serverDate, options = {}) {
        const now = new Date();
        const kstTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
        // YYYY-MM-DD HH:MM 형식으로 포맷
        const year = kstTime.getFullYear();
        const month = String(kstTime.getMonth() + 1).padStart(2, '0');
        const day = String(kstTime.getDate()).padStart(2, '0');
        const hours = String(kstTime.getHours()).padStart(2, '0');
        const minutes = String(kstTime.getMinutes()).padStart(2, '0');
        const dateTimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;

        // Default to SUCCESS style if no options provided
        const title = options.title || "🎉 엔드필드 출석 체크 완료!";
        const color = options.color || 13883715; // Default yellow-green

        const embed = {
            title: title,
            color: color,
            fields: [
                {
                    name: "📅 일시",
                    value: dateTimeStr,
                    inline: false
                }
            ],
            footer: {
                text: "Endfield Auto Check-in"
            },
            timestamp: now.toISOString()
        };

        // Extract attendance data from API response
        if (data && data.rawData && data.rawData.data) {
            const apiData = data.rawData.data;
            let rewardName = "";
            let rewardCount = "";
            let rewardIcon = "";

            // --- Logic adapted from ref/main.gs ---
            if (apiData.calendar) {
                // The calendar array contains objects like { day: 1, awardId: "...", done: true/false }
                // We want the latest 'done' item.
                const doneItems = apiData.calendar.filter(item => item.done === true);

                if (doneItems.length > 0) {
                    const latestReward = doneItems[doneItems.length - 1]; // Last completed item

                    // The reward details are in a separate map: resourceInfoMap
                    if (apiData.resourceInfoMap && latestReward.awardId) {
                        const info = apiData.resourceInfoMap[latestReward.awardId];
                        if (info) {
                            // "name": "Item Name | Extra info" -> split by pipe
                            rewardName = info.name ? info.name.split('|')[0] : "알 수 없는 보상";
                            rewardCount = info.count;
                            rewardIcon = info.icon;
                        }
                    }

                    // Also try to get signCount strictly from calendar length
                    const calculatedSignCount = doneItems.length;

                    // Cumulative attendance days
                    embed.fields.push({
                        name: "📊 누적 출석",
                        value: `${calculatedSignCount}일`,
                        inline: true
                    });
                }
            }
            // Fallback: If calendar is missing (e.g. POST response might be different?), try other fields
            else {
                const signCount = apiData.signCount || apiData.sign_count || apiData.totalSignCount || apiData.currentSignCount;
                if (signCount !== undefined) {
                    embed.fields.push({
                        name: "📊 누적 출석",
                        value: `${signCount}일`,
                        inline: true
                    });
                }

                if (apiData.rewards && apiData.rewards.length > 0) {
                    const r = apiData.rewards[0];
                    rewardName = r.name;
                    rewardCount = r.count;
                    rewardIcon = r.icon;
                }
            }

            if (rewardName) {
                let rewardText = rewardName;
                if (rewardCount) {
                    rewardText += ` x${rewardCount}`;
                }

                embed.fields.push({
                    name: "🎁 오늘의 보상",
                    value: rewardText,
                    inline: false
                });

                if (rewardIcon) {
                    embed.thumbnail = {
                        url: rewardIcon
                    };
                }
            } else {
                console.log("[Discord] Reward parsing failed even with new logic. Data keys:", Object.keys(apiData));
            }
        }

        return embed;
    }
}

class CheckInController {
    constructor() {
        this.store = new AccountStore();
        this.service = new CheckInService(this.store);
        this.discordService = new DiscordWebhookService(this.store);
    }
    init() {
        this.scheduleNextRun();

        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === ALARM_NAME) {
                this.run(false);
            }
        });

        chrome.runtime.onStartup.addListener(() => {
            this.checkOnStartup();
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

        this.checkOnStartup();
        this.initCookieListener();
    }

    getNextRunTime() {
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setHours(1, 5, 0, 0); // 01:05 AM

        if (now >= nextRun) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        return nextRun.getTime();
    }

    scheduleNextRun() {
        const nextRunTime = this.getNextRunTime();

        chrome.alarms.clear(ALARM_NAME, () => {
            chrome.alarms.create(ALARM_NAME, {
                when: nextRunTime,
                periodInMinutes: 1440
            });
        });
    }

    async checkOnStartup() {
        const now = new Date();
        const todayTarget = new Date();
        todayTarget.setHours(1, 5, 0, 0);

        if (now > todayTarget) {
            await this.run(false);
        }
    }

    initCookieListener() {
        chrome.cookies.onChanged.addListener(async (changeInfo) => {
            if (changeInfo.removed) return;

            const domain = changeInfo.cookie.domain;
            const name = changeInfo.cookie.name;
            const value = changeInfo.cookie.value;

            const isTargetDomain = TARGET_DOMAINS.some(d => domain.includes(d));
            if (!isTargetDomain) return;

            const isTargetCookie = ['SK_OAUTH_CRED_KEY', 'cred', 'sk_cred'].includes(name);

            if (isTargetCookie) {
                const allCookies = await this.service.getAllCookies();
                const updated = await this.store.updateCredential(value, allCookies);

                if (updated) {
                    this.store.addLog("INFO", "쿠키 감지: 인증 정보 및 전체 쿠키 갱신됨");
                }
            }
        });
    }

    async run(force) {
        const lastDate = await this.store.get('lastCheckDate');
        const serverToday = this.service.getServerTodayString();
        const lastStatus = await this.store.get('lastStatus');

        if (!force && lastDate === serverToday && lastStatus === "SUCCESS") {
            this.clearBadge(); return;
        }

        await this.store.set('isRunning', true);
        const result = await this.service.executeAttendance();
        this.handleResult(result, force);
    }

    async handleResult(result, isManual = false) {
        const serverToday = this.service.getServerTodayString();
        const timeString = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        await this.store.addLog(result.code, result.msg);

        if (result.code === "SUCCESS" || result.code === "ALREADY_DONE") {
            this.clearBadge();
            await this.store.saveResult("SUCCESS", serverToday, timeString);

            if (result.code === "SUCCESS") {
                await this.discordService.sendAttendanceNotification(result, serverToday);
            } else if (result.code === "ALREADY_DONE" && isManual) {
                // 수동 실행일 때만 '이미 완료됨' 알림 전송 (자동 실행 시 스팸 방지)
                await this.discordService.sendAlreadyDoneNotification(result);
            }
        } else {
            this.setBadgeX();
            await this.store.saveResult("FAIL", serverToday, timeString);

            await this.discordService.sendErrorNotification(result.msg || "출석 체크 실패");
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