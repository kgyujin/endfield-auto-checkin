const storage = chrome.storage.sync;
const ALARM_NAME = "dailyCheckIn";

// Node.js 코드에서 가져온 호요랩 API 설정값
const HOYO_CONFIG = {
    ENDPOINTS: {
        'zzz': { 
            url: 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign', 
            act_id: 'e202406031448091', 
            name: '젠레스 존 제로' 
        },
        'gi': { 
            url: 'https://sg-hk4e-api.hoyolab.com/event/sol/sign', 
            act_id: 'e202102251931481', 
            name: '원신' 
        },
        'hsr': { 
            url: 'https://sg-public-api.hoyolab.com/event/luna/os/sign', 
            act_id: 'e202303301540311', 
            name: '붕괴: 스타레일' 
        },
        'hi3': { 
            url: 'https://sg-public-api.hoyolab.com/event/mani/sign', 
            act_id: 'e202110291205111', 
            name: '붕괴3rd' 
        },
        'tot': { 
            url: 'https://sg-public-api.hoyolab.com/event/luna/os/sign', 
            act_id: 'e202202281857121', 
            name: '미해결사건부' 
        }
    },
    // 헤더 설정 (Node.js 코드 참조)
    HEADERS_TEMPLATE: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.6',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json;charset=UTF-8',
        'Origin': 'https://act.hoyolab.com',
        'Referer': 'https://act.hoyolab.com/',
        'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"', // 확장프로그램 환경에 맞게 조정
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
    }
};

// --- [Lifecycle] 초기화 및 스케줄링 ---

// 1. 브라우저 시작 시 자동 실행
chrome.runtime.onStartup.addListener(() => {
    console.log("[AutoCheck] 브라우저 시작. 자동 점검 시작.");
    checkAll();
    setupAlarm();
});

// 2. 설치 시 실행
chrome.runtime.onInstalled.addListener(() => {
    console.log("[AutoCheck] 설치됨. 초기화.");
    checkAll();
    setupAlarm();
});

// 3. 알람(타이머) 발생 시 실행
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log("[AutoCheck] 정기 점검 알람 실행");
        checkAll();
    }
});

// 4. 메시지 수신 (팝업 버튼 등)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "manualRun") {
        checkAll(true); // 강제 실행
    } else if (message.action === "checkInResult") {
        // content.js(엔드필드 등)에서 온 결과 처리
        handleDomResult(message.status, message.url, sender.tab?.id);
    }
});

function setupAlarm() {
    // 60분(1시간)마다 체크하여 누락된 출석 시도
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
}

// --- [Main Logic] 전체 체크 프로세스 ---

async function checkAll(force = false) {
    // 1. 설정 확인 (자동 실행 켜져있는지)
    if (!force) {
        const config = await storage.get(['isAutoCheckEnabled']);
        if (config.isAutoCheckEnabled === false) {
            console.log("[AutoCheck] 자동 실행이 비활성화되어 건너뜁니다.");
            return;
        }
    }

    const today = getTodayString();
    
    // --- PART A: 호요랩 API 자동 출석 ---
    await processHoyoLabAuto(today, force);

    // --- PART B: 기타 사이트 (엔드필드 등 DOM 방식) ---
    await processDomSites(today);
}

// --- [HoyoLab] API 기반 로직 ---

async function processHoyoLabAuto(today, force) {
    // 쿠키 가져오기 (hoyolab.com 도메인)
    const cookieStr = await getHoyoCookies();
    if (!cookieStr) {
        if (force) notify("오류", "HoYoLAB 로그인 정보가 없습니다. 웹사이트에 로그인해주세요.");
        return;
    }

    const historyData = await storage.get(['hoyoHistory']);
    const history = historyData.hoyoHistory || {};
    
    // 오늘 기록 초기화
    if (!history[today]) history[today] = {};

    let results = [];
    let hasNewSuccess = false;

    for (const [key, info] of Object.entries(HOYO_CONFIG.ENDPOINTS)) {
        // 이미 성공했거나 완료된 게임은 스킵 (강제 실행일 경우 무시하고 다시 체크)
        if (!force && history[today][key] === true) {
            continue;
        }

        try {
            const res = await callHoyoApi(key, info, cookieStr);
            
            // 결과 처리 (Node.js 코드 참조: 0=성공, -5003=이미함)
            if (res.retcode === 0) {
                history[today][key] = true;
                results.push(`${info.name}: ✅ 출석 성공`);
                hasNewSuccess = true;
            } else if (res.retcode === -5003) {
                history[today][key] = true; // 이미 했으면 성공으로 간주
                // 이미 완료된건 굳이 알림 안 띄움 (조용히 처리)
                console.log(`[AutoCheck] ${info.name}: 이미 완료됨`);
            } else {
                console.warn(`[AutoCheck] ${info.name} 실패: ${res.message}`);
                // 실패 시 알림에 포함하지 않음 (다음에 재시도)
            }
        } catch (e) {
            console.error(`[AutoCheck] ${info.name} 에러:`, e);
        }

        // 과도한 요청 방지 딜레이
        await new Promise(r => setTimeout(r, 1500));
    }

    // 변경된 기록 저장
    await storage.set({ hoyoHistory: history });

    // 성공한 건이 있으면 토스트 알림
    if (results.length > 0) {
        notify("HoYoLAB 자동 출석", results.join("\n"));
    } else if (force && !hasNewSuccess) {
        notify("알림", "모든 호요랩 게임이 이미 출석 완료 상태입니다.");
    }
}

async function callHoyoApi(gameKey, info, cookie) {
    const apiUrl = `${info.url}?act_id=${info.act_id}&lang=ko-kr`;
    
    const headers = { ...HOYO_CONFIG.HEADERS_TEMPLATE };
    headers['x-rpc-signgame'] = gameKey;
    // 확장프로그램에서는 fetch 시 쿠키가 자동 전송되지만, 
    // 호요랩 일부 API는 헤더에 명시적으로 쿠키를 요구할 수 있으므로 추가해봄.
    // (Note: 브라우저 보안상 일부 헤더는 무시될 수 있음)
    
    const body = JSON.stringify({ 
        lang: 'en-us', 
        act_id: info.act_id 
    });

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: body
    });

    return await response.json();
}

async function getHoyoCookies() {
    const cookies = await chrome.cookies.getAll({ domain: "hoyolab.com" });
    if (cookies.length === 0) return null;
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// --- [DOM Sites] 엔드필드 등 처리 ---

async function processDomSites(today) {
    const data = await storage.get(['sites']);
    const sites = data.sites || [];
    
    // 호요랩 제외 (위에서 API로 처리함), 오늘 안한 사이트 필터링
    const targetSites = sites.filter(s => 
        !s.url.includes("hoyolab.com") && s.lastCheckIn !== today
    );

    if (targetSites.length > 0) {
        console.log(`[AutoCheck] DOM 방식 사이트 ${targetSites.length}개 점검 시작`);
        for (const site of targetSites) {
            await openTabAndCheckIn(site);
        }
    }
}

function openTabAndCheckIn(site) {
    return new Promise((resolve) => {
        chrome.tabs.create({ url: site.url, active: false }, (tab) => {
            // content.js가 로드되어 처리할 시간을 줌 (최대 20초)
            setTimeout(() => {
                chrome.tabs.get(tab.id, (t) => {
                    if (!chrome.runtime.lastError && t) chrome.tabs.remove(tab.id);
                    resolve();
                });
            }, 20000);
        });
    });
}

function handleDomResult(status, url, tabId) {
    const today = getTodayString();
    
    if (status === "success" || status === "already_done") {
        storage.get(['sites'], (result) => {
            const sites = result.sites || [];
            const target = sites.find(s => url.includes(s.url.split('?')[0]));
            
            if (target) {
                target.lastCheckIn = today;
                storage.set({ sites });
                
                if (status === "success") {
                    notify("출석 성공", `${target.name}: 체크 완료 ✅`);
                }
            }
        });
    }
    
    if (tabId) {
        setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 1000);
    }
}

// --- [Utils] ---

function getTodayString() {
    const offset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - offset).toISOString().split('T')[0];
}

function notify(title, msg) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: title,
        message: msg,
        priority: 2
    });
}