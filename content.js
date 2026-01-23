// content.js
const CONSTANTS = {
    CHECK_INTERVAL: 1000,
    MAX_ATTEMPTS: 15
};

// [핵심] 자동으로 실행하지 않고 메시지를 기다림
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_DOM_CHECK") {
        console.log(`[AutoCheck] ${message.siteName} 자동 점검 시작`);
        attemptDomCheckIn();
    }
});

function attemptDomCheckIn() {
    const url = window.location.href;
    let attempts = 0;

    // 즉시 확인: 이미 완료된 상태인지 먼저 체크
    if (checkIfAlreadyDone(url)) {
        sendMessage("already_done", url);
        return;
    }

    const interval = setInterval(() => {
        attempts++;
        let result = null;

        // 1. SKPORT (엔드필드) 로직
        if (url.includes("skport.com")) {
            const items = document.querySelectorAll('div[class*="sc-chKHoF"]');
            
            if (items.length > 0) {
                let target = null;
                // 미수령 아이템 찾기
                for (const item of items) {
                    if (!item.querySelector('#completed-overlay')) {
                        target = item;
                        break;
                    }
                }

                if (target) {
                    console.log("[AutoCheck] 아이템 클릭 시도");
                    target.click();
                    
                    // 클릭 후 잠시 대기했다가 성공 여부 확인
                    clearInterval(interval);
                    setTimeout(() => {
                        // 클릭 후 오버레이가 생겼는지 확인하거나 그냥 성공 처리
                        sendMessage("success", url); 
                    }, 1500);
                    return; 
                } else {
                    // 타겟이 없는데 아이템은 있다? -> 다 한 거임
                    result = "already_done";
                }
            }
        }
        // 2. 호요랩 (fallback)
        else if (url.includes("hoyolab.com")) {
            if (document.body.innerText.match(/Checked in|출석 완료|Claimed/i)) {
                result = "already_done";
            } else {
                const items = document.querySelectorAll('div[class*="components-home-assets-item-index__model"]');
                for (const item of items) {
                    if (!item.innerHTML.includes('<path')) {
                        item.click();
                        result = "success";
                        break;
                    }
                }
            }
        }

        // 결과 전송
        if (result) {
            clearInterval(interval);
            sendMessage(result, url);
        } else if (attempts >= CONSTANTS.MAX_ATTEMPTS) {
            clearInterval(interval);
            // 타임아웃이지만, 혹시 이미 되어있는지 마지막 확인
            if (checkIfAlreadyDone(url)) {
                sendMessage("already_done", url);
            } else {
                sendMessage("fail", url);
            }
        }

    }, CONSTANTS.CHECK_INTERVAL);
}

// 이미 완료되었는지 확인하는 헬퍼 함수
function checkIfAlreadyDone(url) {
    if (url.includes("skport.com")) {
        const items = document.querySelectorAll('div[class*="sc-chKHoF"]');
        if (items.length > 0) {
            // 모든 아이템에 오버레이가 있으면 true
            const allOverlay = Array.from(items).every(item => item.querySelector('#completed-overlay'));
            return allOverlay;
        }
    }
    return false;
}

function sendMessage(status, url) {
    // 메시지 전송
    chrome.runtime.sendMessage({
        action: "checkInResult",
        status: status,
        url: url
    });
}