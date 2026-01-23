// content.js
const CONSTANTS = {
    DELAY_INIT: 3000,
    CHECK_INTERVAL: 1000,
    MAX_ATTEMPTS: 20
};

setTimeout(() => {
    attemptDomCheckIn();
}, CONSTANTS.DELAY_INIT);

function attemptDomCheckIn() {
    const url = window.location.href;
    
    // 호요랩 API 처리는 background에서 하므로 여기선 DOM 처리만
    // (background에서 DOM 모드로 넘겨준 경우에만 작동)
    // 현재는 모든 사이트 대상으로 모니터링하되, 호요랩은 API우선이라 충돌 방지 필요
    // 하지만 background.js가 탭을 열 때만 이 코드가 의미가 있으므로 그대로 둠

    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        let result = null;

        // 1. SKPORT (엔드필드)
        if (url.includes("skport.com")) {
            const items = document.querySelectorAll('div[class*="sc-chKHoF"]');
            if (items.length > 0) {
                let target = null;
                let allDone = true;
                for (const item of items) {
                    if (!item.querySelector('#completed-overlay')) {
                        target = item;
                        allDone = false;
                        break;
                    }
                }
                if (target) { target.click(); result = "success"; }
                else if (allDone) { result = "already_done"; }
            }
        }
        // 2. HoYoLAB (API 실패 시 백업 DOM 로직)
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

        if (result) {
            clearInterval(interval);
            sendMessage(result, url);
        } else if (attempts >= CONSTANTS.MAX_ATTEMPTS) {
            clearInterval(interval);
            sendMessage("fail", url);
        }
    }, CONSTANTS.CHECK_INTERVAL);
}

function sendMessage(status, url) {
    setTimeout(() => {
        chrome.runtime.sendMessage({ action: "checkInResult", status, url });
    }, 1000);
}