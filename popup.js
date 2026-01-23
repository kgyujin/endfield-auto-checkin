const storage = chrome.storage.sync;

// --- Services ---
const StorageService = {
    getSites() {
        return new Promise((resolve) => {
            storage.get(['sites'], (result) => resolve(result.sites || []));
        });
    },
    saveSites(sites) {
        return new Promise((resolve) => storage.set({ sites }, resolve));
    },
    // 전체 자동 실행 토글 관리
    getGlobalToggle() {
        return new Promise((resolve) => {
            storage.get(['isGlobalActive'], (result) => resolve(result.isGlobalActive !== false)); // Default true
        });
    },
    setGlobalToggle(isActive) {
        return new Promise((resolve) => storage.set({ isGlobalActive: isActive }, resolve));
    }
};

// --- App Controller ---
const App = {
    async init() {
        this.bindEvents();
        this.renderList();
        
        // 전체 토글 초기화
        const isGlobalActive = await StorageService.getGlobalToggle();
        document.getElementById('globalToggle').checked = isGlobalActive;
    },

    bindEvents() {
        document.getElementById('saveBtn').addEventListener('click', () => this.handleSave());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearForm());
        document.getElementById('addCurrentSiteBtn').addEventListener('click', () => this.handleAddCurrent());
        
        // 전체 실행 토글
        document.getElementById('globalToggle').addEventListener('change', (e) => {
            StorageService.setGlobalToggle(e.target.checked);
        });

        // 즉시 실행 (토글 무시하고 강제 실행)
        document.getElementById('runNowBtn').addEventListener('click', () => {
            Modal.show("즉시 실행", "모든 사이트(활성화된)의 출석을 점검합니다.<br>진행하시겠습니까?", () => {
                chrome.runtime.sendMessage({ action: "manualRun" });
                // 팝업 닫지 않음 (결과 확인용, 원하면 window.close() 추가)
            });
        });
    },

    async renderList() {
        const sites = await StorageService.getSites();
        const listDiv = document.getElementById('siteList');
        const today = new Date().toISOString().split('T')[0]; // UTC to YYYY-MM-DD (simplified) -> 실제론 background와 동일한 로직 사용 권장

        listDiv.innerHTML = '';

        if (sites.length === 0) {
            listDiv.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">등록된 사이트가 없습니다.</div>';
            return;
        }

        sites.forEach(site => {
            const isDone = site.lastCheckIn === this.getTodayString();
            // 기본값 true 호환성
            const isEnabled = site.isEnabled !== false; 
            
            const div = document.createElement('div');
            div.className = 'site-item';
            
            // 사이트별 토글 스위치 HTML
            const toggleHtml = `
                <label class="switch small">
                    <input type="checkbox" class="site-toggle" data-id="${site.id}" ${isEnabled ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;

            div.innerHTML = `
                <div class="status-icon" style="opacity: ${isDone ? '1' : '0.3'}" title="${isDone ? '오늘 완료' : '대기'}">
                    ${isDone ? '✅' : '⚪️'}
                </div>
                <div class="site-info">
                    <a href="${site.url}" target="_blank" class="site-name">${site.name}</a>
                    <span class="site-url" title="클릭하여 복사">${site.url}</span>
                </div>
                <div class="actions">
                    ${toggleHtml}
                    <button class="icon-btn edit-btn" title="수정">✏️</button>
                    <button class="icon-btn del-btn" style="color:var(--danger-color)" title="삭제">🗑️</button>
                </div>
            `;

            // 이벤트 바인딩
            this.bindItemEvents(div, site);
            listDiv.appendChild(div);
        });
    },

    bindItemEvents(div, site) {
        // 복사
        const urlSpan = div.querySelector('.site-url');
        urlSpan.addEventListener('click', () => {
            navigator.clipboard.writeText(site.url);
            const original = urlSpan.innerText;
            urlSpan.innerText = "복사됨! ✅";
            urlSpan.style.color = "var(--brand-color)";
            setTimeout(() => { urlSpan.innerText = original; urlSpan.style.color = ""; }, 1500);
        });

        // 수정
        div.querySelector('.edit-btn').addEventListener('click', () => {
            document.getElementById('editId').value = site.id;
            document.getElementById('siteName').value = site.name;
            document.getElementById('siteUrl').value = site.url;
            document.getElementById('saveBtn').innerText = "수정 완료";
            document.querySelector('.edit-card').scrollIntoView({ behavior: 'smooth' });
        });

        // 삭제
        div.querySelector('.del-btn').addEventListener('click', () => {
            Modal.show("삭제 확인", `'${site.name}'을(를) 삭제하시겠습니까?`, async () => {
                const sites = await StorageService.getSites();
                const newSites = sites.filter(s => String(s.id) !== String(site.id));
                await StorageService.saveSites(newSites);
                this.renderList();
            });
        });

        // 사이트별 토글
        div.querySelector('.site-toggle').addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            const sites = await StorageService.getSites();
            const target = sites.find(s => String(s.id) === String(site.id));
            if (target) {
                target.isEnabled = isChecked;
                await StorageService.saveSites(sites);
            }
        });
    },

    async handleSave() {
        const id = document.getElementById('editId').value;
        const name = document.getElementById('siteName').value.trim();
        const url = document.getElementById('siteUrl').value.trim();

        if (!name || !url) {
            Modal.show("알림", "이름과 URL을 모두 입력해주세요.", null, false);
            return;
        }

        const sites = await StorageService.getSites();

        if (id) {
            const index = sites.findIndex(s => String(s.id) === String(id));
            if (index !== -1) {
                sites[index].name = name;
                sites[index].url = url;
            }
        } else {
            sites.push({
                id: Date.now(),
                name: name,
                url: url,
                lastCheckIn: "",
                isEnabled: true // 신규 추가는 기본 켜짐
            });
        }

        await StorageService.saveSites(sites);
        this.clearForm();
        this.renderList();
    },

    async handleAddCurrent() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                document.getElementById('siteName').value = tabs[0].title;
                document.getElementById('siteUrl').value = tabs[0].url;
                document.getElementById('saveBtn').innerText = "이대로 저장";
                document.querySelector('.edit-card').scrollIntoView({ behavior: 'smooth' });
            }
        });
    },

    clearForm() {
        document.getElementById('editId').value = '';
        document.getElementById('siteName').value = '';
        document.getElementById('siteUrl').value = '';
        document.getElementById('saveBtn').innerText = "저장하기";
    },

    getTodayString() {
        const offset = new Date().getTimezoneOffset() * 60000;
        return new Date(Date.now() - offset).toISOString().split('T')[0];
    }
};

// 모달
const Modal = {
    overlay: document.getElementById('customModal'),
    show(title, message, onConfirm, showCancel = true) {
        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalMessage').innerHTML = message;
        
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');

        cancelBtn.style.display = showCancel ? 'block' : 'none';
        confirmBtn.className = showCancel ? 'modal-btn confirm' : 'modal-btn single';

        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newConfirm.addEventListener('click', () => { if (onConfirm) onConfirm(); this.hide(); });
        newCancel.addEventListener('click', () => this.hide());

        this.overlay.classList.add('active');
    },
    hide() { this.overlay.classList.remove('active'); }
};

document.addEventListener('DOMContentLoaded', () => App.init());