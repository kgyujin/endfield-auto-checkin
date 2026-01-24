/**
 * Endfield Auto Check-in v14.0 (Enhanced Security & Performance)
 */

const API_ATTEND = "https://zonai.skport.com/web/v1/game/endfield/attendance";
const API_BINDING = "https://zonai.skport.com/api/v1/game/player/binding";
const REFERER_URL = "https://game.skport.com/";
// [중요] 쿠키 탐색 도메인 명시
const TARGET_DOMAINS = ["skport.com", "game.skport.com", "gryphline.com"];
const ALARM_NAME = "dailyCheckIn";

// Security: Simple obfuscation for sensitive data (not encryption, just basic masking)
const SecurityHelper = {
    maskCred(cred) {
        if (!cred || cred.length < 8) return cred;
        return cred.substring(0, 4) + '***' + cred.substring(cred.length - 4);
    },
    
    sanitizeError(error) {
        // Remove sensitive information from error messages
        if (typeof error === 'string') {
            return error.replace(/cred[=:]\s*[A-Za-z0-9]+/gi, 'cred=***')
                        .replace(/token[=:]\s*[A-Za-z0-9]+/gi, 'token=***');
        }
        return error?.message || String(error);
    }
};

// Performance: Cache for account data
const CacheManager = {
    accountCache: null,
    cacheTime: 0,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    
    async getAccount(store) {
        const now = Date.now();
        if (this.accountCache && (now - this.cacheTime) < this.CACHE_DURATION) {
            return this.accountCache;
        }
        this.accountCache = await store.getAccount();
        this.cacheTime = now;
        return this.accountCache;
    },
    
    invalidate() {
        this.accountCache = null;
        this.cacheTime = 0;
    }
};

// I18n translations for background script
const Translations = {
    ko: {
        'checkin.success': '출석 성공',
        'checkin.alreadyDone': '이미 완료됨',
        'checkin.needAccount': '계정 연동 필요',
        'checkin.fail': '출석 실패',
        'logs.syncSuccess': '계정 연동 성공',
        'logs.unlink': '연동 해제',
        'error.unknown': '알 수 없는 오류',
        'error.noLogin': '로그인 정보를 찾을 수 없습니다. 사이트 로그인 상태를 확인해주세요.',
        'error.apiTest': 'API 테스트 실패',
        'error.unauthorized': '인증 실패: 로그인 상태를 확인해주세요.',
        'error.apiTestFail': 'API 테스트 실패',
        'error.authFail': '인증 실패: 계정 연동을 다시 해주세요.',
        'error.statusCheckFail': '상태 확인 실패',
        'error.checkinFail': '출석 체크 실패',
        'notif.checkinComplete': '출석 완료',
        'notif.rewardReceived': '보상 지급됨',
        'notif.error': '오류',
        'notif.checkLogs': '로그를 확인하세요.',
    },
    en: {
        'checkin.success': 'Check-in Success',
        'checkin.alreadyDone': 'Already Done',
        'checkin.needAccount': 'Account link required',
        'checkin.fail': 'Check-in Failed',
        'logs.syncSuccess': 'Account link success',
        'logs.unlink': 'Unlinked',
        'error.unknown': 'Unknown error',
        'error.noLogin': 'Login info not found. Please check your login status on the site.',
        'error.apiTest': 'API test failed',
        'error.unauthorized': 'Authentication failed: Please check your login status.',
        'error.apiTestFail': 'API test failed',
        'error.authFail': 'Authentication failed: Please re-link your account.',
        'error.statusCheckFail': 'Status check failed',
        'error.checkinFail': 'Check-in failed',
        'notif.checkinComplete': 'Check-in Complete',
        'notif.rewardReceived': 'Reward received',
        'notif.error': 'Error',
        'notif.checkLogs': 'Please check logs.',
    }
};

// Translation helper for background script
async function t(key, ...args) {
    try {
        const data = await chrome.storage.local.get(['language']);
        const lang = data.language || 'ko';
        const translation = Translations[lang]?.[key] || Translations['ko'][key] || key;
        
        if (args.length > 0) {
            return translation.replace(/\{(\d+)\}/g, (match, index) => {
                return args[parseInt(index)] || match;
            });
        }
        return translation;
    } catch (e) {
        // Fallback to Korean if error
        return Translations['ko'][key] || key;
    }
}

class AccountStore {
    async get(key) {
        const data = await chrome.storage.local.get([key]);
        return data[key];
    }
    async set(key, value) {
        return chrome.storage.local.set({ [key]: value });
    }
    
    async addLog(status, message) {
        try {
            let logs = (await this.get('checkInLogs')) || [];
            // Get language for date format
            const langData = await chrome.storage.local.get(['language']);
            const lang = langData.language || 'ko';
            const locale = lang === 'en' ? 'en-US' : 'ko-KR';
            const now = new Date().toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
            // Security: Sanitize message to remove sensitive data
            const sanitizedMsg = SecurityHelper.sanitizeError(message);
            logs.unshift({ date: now, status: status, msg: sanitizedMsg });
            if (logs.length > 3) logs = logs.slice(0, 3);
            await this.set('checkInLogs', logs);
        } catch (e) {
            console.error('Failed to add log:', e);
        }
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
}

class CheckInService {
    constructor(store) { this.store = store; }

    getServerTodayString() {
        const now = new Date();
        const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
        return utc8Time.toISOString().split('T')[0];
    }

    async getHeaders(method, cred, role) {
        try {
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const headers = {
                "Accept": "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "ko,ko-KR;q=0.9,en-US;q=0.8,en;q=0.7",
                "Origin": "https://game.skport.com",
                "Referer": REFERER_URL,
                "User-Agent": navigator.userAgent,
                "Platform": "3",
                "Vname": "1.0.0",
                "Sk-Language": "ko",
                "Timestamp": timestamp
            };

            if (method === "POST") headers["Content-Type"] = "application/json";
            
            // Performance: Use cache for account data
            if (!cred || !role) {
                const account = await CacheManager.getAccount(this.store);
                if (account) {
                    cred = cred || account.cred;
                    role = role || account.role;
                }
            }

            if (cred) headers["cred"] = cred;
            if (role) headers["sk-game-role"] = role;

            return headers;
        } catch (e) {
            console.error('Error in getHeaders:', SecurityHelper.sanitizeError(e));
            throw e;
        }
    }

    async fetchWithRetry(url, options, retries = 2) {
        let lastError = null;
        for (let i = 0; i <= retries; i++) {
            try {
                // Performance: Add timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (response.status === 401) {
                    throw new Error("401 Unauthorized");
                }
                if (response.ok) return response;
                throw new Error(`HTTP ${response.status}`);
            } catch (err) {
                lastError = err;
                // Enhanced error handling
                if (err.name === 'AbortError') {
                    throw new Error("Request timeout");
                }
                if (err.message.includes("401") || err.message.includes("Unauthorized")) {
                    throw err; // Don't retry auth errors
                }
                if (i === retries) {
                    throw lastError;
                }
                // Exponential backoff
                await new Promise(r => setTimeout(r, 1000 * (i + 1))); 
            }
        }
    }

    // [강화] 모든 도메인 쿠키 수집 (with error handling)
    async getAllCookies() {
        let allCookies = [];
        for (const domain of TARGET_DOMAINS) {
            try {
                const cookies = await chrome.cookies.getAll({ domain: domain });
                allCookies = allCookies.concat(cookies);
            } catch(e) {
                console.warn(`Failed to get cookies for ${domain}:`, SecurityHelper.sanitizeError(e));
            }
        }
        return allCookies;
    }

    findCredInCookies(cookies) {
        // sk_cred가 cred보다 우선순위가 높을 수 있음
        const target = cookies.find(c => c.name === 'cred' || c.name === 'sk_cred');
        return target ? target.value : null;
    }

    async fetchGameRole(cred) {
        try {
            if (!cred) {
                console.warn('fetchGameRole: No cred provided');
                return null;
            }
            const headers = await this.getHeaders("GET", cred, null);
            const url = `${API_BINDING}?gameId=3`; 
            const response = await this.fetchWithRetry(url, {
                method: "GET", headers: headers, credentials: "include"
            });
            
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            
            const data = await response.json();

            if (data.code === 0 && data.data?.list?.[0]?.bindingList?.[0]?.roles?.[0]) {
                const roleData = data.data.list[0].bindingList[0].roles[0];
                return `3_${roleData.roleId}_${roleData.serverId}`;
            }
            return null;
        } catch (e) {
            console.warn('fetchGameRole error:', SecurityHelper.sanitizeError(e));
            return null;
        }
    }

    async syncAccountData(localStorageData) {
        try {
            // Security: Validate input
            if (!localStorageData || typeof localStorageData !== 'object') {
                localStorageData = {};
            }
            
            const cookies = await this.getAllCookies();
            
            // 1. cred 찾기 (로컬스토리지 우선 -> 쿠키)
            let cred = localStorageData?.cred || this.findCredInCookies(cookies);
            
            if (!cred || typeof cred !== 'string' || cred.length < 8) {
                const errorMsg = await t('error.noLogin');
                throw new Error(errorMsg);
            }

            // 2. role 찾기 (로컬스토리지 우선 -> API 조회)
            let role = localStorageData?.role;
            if (!role || typeof role !== 'string') {
                role = await this.fetchGameRole(cred);
            }
            
            if (!role) {
                console.warn("캐릭터 정보(Role)를 찾지 못했습니다. (연동은 진행)");
            }

            // 3. API 테스트 with enhanced error handling
            let response;
            try {
                const headers = await this.getHeaders("GET", cred, role);
                response = await this.fetchWithRetry(API_ATTEND, {
                    method: "GET", headers: headers, credentials: "include"
                });
            } catch (e) {
                const errorMsg = SecurityHelper.sanitizeError(e);
                if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
                    const authError = await t('error.unauthorized');
                    throw new Error(authError);
                }
                const apiTestError = await t('error.apiTestFail');
                throw new Error(`${apiTestError}: ${errorMsg}`);
            }
            
            if (!response || !response.ok) {
                const apiTestError = await t('error.apiTestFail');
                throw new Error(`${apiTestError}: HTTP ${response?.status || 'unknown'}`);
            }

            // Security: Don't store full cookies, only necessary data
            // Get language for date format
            const langData = await chrome.storage.local.get(['language']);
            const lang = langData.language || 'ko';
            const locale = lang === 'en' ? 'en-US' : 'ko-KR';
            const accountInfo = {
                uid: "Linked",
                cred: cred,
                role: role || "", 
                // Don't store full cookies array for security
                lastSync: new Date().toLocaleString(locale)
            };
            
            await this.store.saveAccount(accountInfo);
            CacheManager.invalidate(); // Clear cache after update
            return { code: "SUCCESS", data: accountInfo };

        } catch (e) {
            // If error message is already translated, use it directly
            // Otherwise, sanitize and use original message
            let errorMsg;
            if (e.message && (e.message.includes('로그인 정보') || e.message.includes('Login info') || 
                e.message.includes('인증 실패') || e.message.includes('Authentication failed') ||
                e.message.includes('API 테스트') || e.message.includes('API test'))) {
                // Already translated message
                errorMsg = e.message;
            } else {
                errorMsg = SecurityHelper.sanitizeError(e);
            }
            console.error('syncAccountData error:', errorMsg);
            return { code: "FAIL", msg: errorMsg };
        }
    }

    async executeAttendance() {
        try {
            // Performance: Use cached account
            const account = await CacheManager.getAccount(this.store);
            if (!account || !account.cred) {
                const needAccountMsg = await t('checkin.needAccount');
                return { code: "FAIL", msg: needAccountMsg };
            }

            // 1. GET (상태 확인) with error handling
            let getRes, getData;
            try {
                const getHeaders = await this.getHeaders("GET", account.cred, account.role);
                getRes = await this.fetchWithRetry(API_ATTEND, {
                    method: "GET", headers: getHeaders, credentials: "include"
                });
                
                if (!getRes.ok) {
                    throw new Error(`GET request failed: ${getRes.status}`);
                }
                
                getData = await getRes.json();
            } catch (e) {
                const errorMsg = SecurityHelper.sanitizeError(e);
                if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
                    const authFailMsg = await t('error.authFail');
                    return { code: "FAIL", msg: authFailMsg };
                }
                const statusCheckFailMsg = await t('error.statusCheckFail');
                return { code: "ERROR", msg: `${statusCheckFailMsg}: ${errorMsg}` };
            }

            if (getData.code === 0 && getData.data && getData.data.hasToday) {
                const alreadyDoneMsg = await t('checkin.alreadyDone');
                return { code: "ALREADY_DONE", msg: alreadyDoneMsg };
            }

            // 2. POST (출석) with error handling
            let postRes, postData;
            try {
                const postHeaders = await this.getHeaders("POST", account.cred, account.role);
                postRes = await this.fetchWithRetry(API_ATTEND, {
                    method: "POST", headers: postHeaders, credentials: "include", body: JSON.stringify({})
                });
                
                if (!postRes.ok) {
                    throw new Error(`POST request failed: ${postRes.status}`);
                }
                
                postData = await postRes.json();
            } catch (e) {
                const errorMsg = SecurityHelper.sanitizeError(e);
                if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
                    const authFailMsg = await t('error.authFail');
                    return { code: "FAIL", msg: authFailMsg };
                }
                const checkinFailMsg = await t('error.checkinFail');
                return { code: "ERROR", msg: `${checkinFailMsg}: ${errorMsg}` };
            }

            if (postData.code === 0 || postData.message === "OK") {
                const successMsg = await t('checkin.success');
                return { code: "SUCCESS", msg: successMsg };
            } else if (postData.code === 10001) {
                const alreadyDoneMsg = await t('checkin.alreadyDone');
                return { code: "ALREADY_DONE", msg: alreadyDoneMsg };
            } else {
                const unknownErrorMsg = await t('error.unknown');
                return { code: "FAIL", msg: postData.message || unknownErrorMsg };
            }
        } catch (e) {
            const errorMsg = SecurityHelper.sanitizeError(e);
            console.error('executeAttendance error:', errorMsg);
            return { code: "ERROR", msg: errorMsg };
        }
    }
}

class CheckInController {
    constructor() {
        this.store = new AccountStore();
        this.service = new CheckInService(this.store);
    }
    async init() {
        try {
            // Check for persistent failure state on init
            const hasFailure = await this.store.get('hasFailure');
            if (hasFailure) {
                this.setBadgeX();
            }
            
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === ALARM_NAME) {
                    this.run(false).catch(e => {
                        console.error('Alarm run error:', SecurityHelper.sanitizeError(e));
                    });
                }
            });
            
            chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === "manualRun") {
                // Check if toggle is active before manual run
                this.store.isAutoRunActive().then(isActive => {
                    if (!isActive) {
                        // Toggle is OFF, don't run
                        this.store.addLog("ERROR", "Auto check-in is disabled");
                        if (sendResponse) {
                            sendResponse({ code: "FAIL", msg: "Auto check-in is disabled" });
                        }
                        return;
                    }
                    // Toggle is ON, proceed with manual run
                    this.run(true);
                    if (sendResponse) {
                        sendResponse({ code: "SUCCESS" });
                    }
                });
                return true; // Keep channel open for async response
            } 
            else if (msg.action === "syncAccount") {
                this.service.syncAccountData(msg.storageData).then(async res => {
                    try {
                        if(res.code === "SUCCESS") {
                            const syncSuccessMsg = await t('logs.syncSuccess');
                            this.store.addLog("SYNC", syncSuccessMsg);
                            CacheManager.invalidate(); // Clear cache
                            // 계정 연동 성공 시 즉시 출석체크 실행
                            const checkInResult = await this.service.executeAttendance();
                            this.handleResult(checkInResult);
                        } else {
                            const unknownErrorMsg = await t('error.unknown');
                            this.store.addLog("ERROR", res.msg || unknownErrorMsg);
                        }
                        sendResponse(res);
                    } catch (e) {
                        const errorMsg = SecurityHelper.sanitizeError(e);
                        console.error('syncAccount handler error:', errorMsg);
                        this.store.addLog("ERROR", errorMsg);
                        sendResponse({ code: "ERROR", msg: errorMsg });
                    }
                }).catch(e => {
                    const errorMsg = SecurityHelper.sanitizeError(e);
                    console.error('syncAccount promise error:', errorMsg);
                    this.store.addLog("ERROR", errorMsg);
                    sendResponse({ code: "ERROR", msg: errorMsg });
                });
                return true; 
            }
            else if (msg.action === "logout") {
                this.store.set('accountInfo', null).then(async () => {
                    CacheManager.invalidate(); // Clear cache
                    this.clearBadge(); // Clear badge on logout
                    const unlinkMsg = await t('logs.unlink');
                    this.store.addLog("LOGOUT", unlinkMsg);
                    sendResponse({ code: "SUCCESS" });
                }).catch(e => {
                    const errorMsg = SecurityHelper.sanitizeError(e);
                    console.error('logout error:', errorMsg);
                    sendResponse({ code: "ERROR", msg: errorMsg });
                });
                return true;
            }
            });
            this.run(false).catch(e => {
                console.error('Initial run error:', SecurityHelper.sanitizeError(e));
            });
        } catch (e) {
            console.error('Init error:', SecurityHelper.sanitizeError(e));
        }
    }
    
    async run(force) {
        try {
            const isActive = await this.store.isAutoRunActive();
            if (!force && !isActive) { 
                // Check if there's a persistent failure state
                const hasFailure = await this.store.get('hasFailure');
                if (hasFailure) {
                    this.setBadgeX(); // Keep failure badge visible
                } else {
                    this.clearBadge();
                }
                return; 
            }

            const lastDate = await this.store.get('lastCheckDate');
            const serverToday = this.service.getServerTodayString();
            const lastStatus = await this.store.get('lastStatus');

            if (!force && lastDate === serverToday && lastStatus === "SUCCESS") {
                this.clearBadge();
                await this.store.set('hasFailure', false); // Clear failure state on success
                return;
            }

            // Check for persistent failure state and show badge
            const hasFailure = await this.store.get('hasFailure');
            if (hasFailure && !force) {
                this.setBadgeX(); // Show failure badge if there's a persistent failure
            }

            await this.store.set('isRunning', true);
            const result = await this.service.executeAttendance();
            this.handleResult(result);
        } catch (e) {
            console.error('run error:', SecurityHelper.sanitizeError(e));
            this.setBadgeX();
            await this.store.set('hasFailure', true);
        }
    }

    async handleResult(result) {
        try {
            const serverToday = this.service.getServerTodayString();
            // Get language for time format
            const langData = await chrome.storage.local.get(['language']);
            const lang = langData.language || 'ko';
            const locale = lang === 'en' ? 'en-US' : 'ko-KR';
            const timeString = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

            await this.store.addLog(result.code, result.msg);

            if (result.code === "SUCCESS" || result.code === "ALREADY_DONE") {
                this.clearBadge();
                await this.store.saveResult("SUCCESS", serverToday, timeString);
                // Clear failure badge state
                await this.store.set('hasFailure', false);
                if (result.code === "SUCCESS") {
                    const completeTitle = await t('notif.checkinComplete');
                    const rewardMsg = await t('notif.rewardReceived');
                    this.notify(completeTitle, rewardMsg);
                }
            } else {
                // Set failure badge and persist failure state
                this.setBadgeX();
                await this.store.saveResult("FAIL", serverToday, timeString);
                await this.store.set('hasFailure', true); // Persist failure state
                if (result.msg && (result.msg.includes("401") || result.code === "FAIL")) {
                    const errorTitle = await t('notif.error');
                    const checkLogsMsg = await t('notif.checkLogs');
                    this.notify(errorTitle, checkLogsMsg);
                }
            }
        } catch (e) {
            console.error('handleResult error:', SecurityHelper.sanitizeError(e));
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