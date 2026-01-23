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
    getGlobalToggle() {
        return new Promise((resolve) => {
            storage.get(['isGlobalActive'], (result) => resolve(result.isGlobalActive !== false));
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
        
        const isGlobalActive = await StorageService.getGlobalToggle();
        document.getElementById('globalToggle').checked = isGlobalActive;
    },

    bindEvents() {
        document.getElementById('saveBtn').addEventListener('click', () => this.handleSave());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearForm());
        document.getElementById('addCurrentSiteBtn').addEventListener('click', () => this.handleAddCurrent());
        
        document.getElementById('globalToggle').addEventListener('change', (e) => {
            StorageService.setGlobalToggle(e.target.checked);
        });

        document.getElementById('runNowBtn').addEventListener('click', () => {
            Modal.show("즉시 실행", "모든 사이트의 출석을 점검합니다.<br>진행하시겠습니까?", () => {
                chrome.runtime.sendMessage({ action: "manualRun" });
            });
        });
    },

    async renderList() {
        const sites = await StorageService.getSites();
        const listDiv = document.getElementById('siteList');
        const today = this.getServerTodayString(); // UTC+8 기준 오늘

        listDiv.innerHTML = '';

        if (sites.length === 0) {
            listDiv.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">등록된 사이트가 없습니다.</div>';
            return;
        }

        sites.forEach(site => {
            const isDone = site.lastCheckIn === today;
            const isEnabled = site.isEnabled !== false; 
            
            const div = document.createElement('div');
            div.className = 'site-item';
            
            const toggleHtml = `
                <label class="switch small">
                    <input type="checkbox" class="site-toggle" data-id="${site.id}" ${isEnabled ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;

            div.innerHTML = `
                <div class="status-icon" style="opacity: ${isDone ? '1' : '0.3'}" title="${isDone ? '오늘 완료 (UTC+8)' : '대기'}">
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

            this.bindItemEvents(div, site);
            listDiv.appendChild(div);
        });
    },

    bindItemEvents(div, site) {
        const urlSpan = div.querySelector('.site-url');
        urlSpan.addEventListener('click', () => {
            navigator.clipboard.writeText(site.url);
            const original = urlSpan.innerText;
            urlSpan.innerText = "복사됨! ✅";
            urlSpan.style.color = "var(--brand-color)";
            setTimeout(() => { urlSpan.innerText = original; urlSpan.style.color = ""; }, 1500);
        });

        div.querySelector('.edit-btn').addEventListener('click', () => {
            document.getElementById('editId').value = site.id;
            document.getElementById('siteName').value = site.name;
            document.getElementById('siteUrl').value = site.url;
            document.getElementById('saveBtn').innerText = "수정 완료";
            document.querySelector('.edit-card').scrollIntoView({ behavior: 'smooth' });
        });

        div.querySelector('.del-btn').addEventListener('click', () => {
            Modal.show("삭제 확인", `'${site.name}'을(를) 삭제하시겠습니까?`, async () => {
                const sites = await StorageService.getSites();
                const newSites = sites.filter(s => String(s.id) !== String(site.id));
                await StorageService.saveSites(newSites);
                this.renderList();
            });
        });

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
                isEnabled: true
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

    // [수정됨] UTC+8 기준 날짜 (Background와 동기화)
    getServerTodayString() {
        const now = new Date();
        const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
        return utc8Time.toISOString().split('T')[0];
    }
};

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