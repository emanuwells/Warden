/**
 * ============================================
 *  WARDEN — System Monitor Frontend
 *  MAIATRON Design System v1.1
 * ============================================
 */

(function () {
    'use strict';

    const CONFIG = {
        credentials: { username: 'admin', password: 'mtron2026!' },
        sessionKey: 'warden_session_v1',
        themeKey: 'warden_theme',
        rangeKey: 'warden_range',
        authConfigUrl: '../../config/auth.local.json',
        payloadUrl: 'warden_payload.json',
        refreshInterval: 30000,
    };

    const RANGE_LABEL = {
        '1h': '1h',
        '24h': '24h',
        '7d': '7d',
    };

    let _selectedRange = localStorage.getItem(CONFIG.rangeKey) || '24h';
    if (!RANGE_LABEL[_selectedRange]) _selectedRange = '24h';
    let _selectedAlertKey = null;

    (async function loadAuthConfig() {
        try {
            const resp = await fetch(CONFIG.authConfigUrl);
            if (!resp.ok) return;
            const cfg = await resp.json();
            if (cfg.username) CONFIG.credentials.username = cfg.username;
            if (cfg.password) CONFIG.credentials.password = cfg.password;
            if (cfg.sessionKey) CONFIG.sessionKey = cfg.sessionKey;
        } catch (_) { }
    })();

    const $ = (id) => document.getElementById(id);
    const el = {
        loginScreen: $('loginScreen'),
        loginForm: $('loginForm'),
        username: $('username'),
        password: $('password'),
        loginError: $('loginError'),
        mainApp: $('mainApp'),
        themeToggle: $('themeToggle'),
        loginThemeToggle: $('loginThemeToggle'),
        refreshBtn: $('refreshBtn'),
        userName: $('userName'),
        logoutBtn: $('logoutBtn'),
        lastUpdated: $('lastUpdated'),
        statusText: $('statusText'),
        toast: $('toast'),
        currentYear: $('currentYear'),
        tabsNav: $('tabsNav'),
        rangeSelector: $('rangeSelector'),
        alertsSummaryBadge: $('alertsSummaryBadge'),
        dbHealthPill: $('dbHealthPill'),
        dbHealthNote: $('dbHealthNote'),
        dbAlertsList: $('dbAlertsList'),
        alertDetailPanel: $('alertDetailPanel'),
        alertHistoryList: $('alertHistoryList'),
        sysHostName: $('sysHostName'),
        sysOsName: $('sysOsName'),
        sysKernel: $('sysKernel'),
        sysHostUptime: $('sysHostUptime'),
    };

    function initTheme() {
        const saved = localStorage.getItem(CONFIG.themeKey) || 'dark';
        setTheme(saved);
    }

    function setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem(CONFIG.themeKey, theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'light' ? 'dark' : 'light');
        if (_lastPayload) renderAll(_lastPayload);
    }

    if (el.themeToggle) el.themeToggle.addEventListener('click', toggleTheme);
    if (el.loginThemeToggle) el.loginThemeToggle.addEventListener('click', toggleTheme);

    function checkSession() {
        try {
            const raw = localStorage.getItem(CONFIG.sessionKey);
            if (!raw) return false;
            const session = JSON.parse(raw);
            if (session.authenticated && session.expiresAt > Date.now()) {
                showMainApp(session.username);
                return true;
            }
        } catch (_) { }
        localStorage.removeItem(CONFIG.sessionKey);
        return false;
    }

    async function hashSignature(username) {
        try {
            const data = new TextEncoder().encode(username + ':warden:' + Date.now());
            const hash = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (_) {
            return btoa(username + ':warden:' + Date.now());
        }
    }

    if (el.loginForm) {
        el.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = el.username.value.trim();
            const password = el.password.value;
            const btn = el.loginForm.querySelector('.login-btn');
            btn.classList.add('loading');

            try {
                await new Promise(r => setTimeout(r, 500));
                if (username === CONFIG.credentials.username && password === CONFIG.credentials.password) {
                    const sig = await hashSignature(username);
                    localStorage.setItem(CONFIG.sessionKey, JSON.stringify({
                        authenticated: true,
                        username,
                        issuedAt: Date.now(),
                        expiresAt: Date.now() + (480 * 60 * 1000),
                        signature: sig,
                    }));
                    showMainApp(username);
                } else {
                    showLoginError('Utilizador ou password incorretos');
                }
            } catch (_) {
                showLoginError('Erro de autenticação. Verifique o deploy.');
            } finally {
                btn.classList.remove('loading');
            }
        });
    }

    function showLoginError(message) {
        if (!el.loginError) return;
        el.loginError.textContent = message;
        el.loginError.classList.add('show');
        if (el.password) {
            el.password.value = '';
            el.password.focus();
        }
        setTimeout(() => el.loginError.classList.remove('show'), 3000);
    }

    function showMainApp(username) {
        el.loginScreen.classList.add('hidden');
        el.mainApp.classList.remove('hidden');
        if (el.userName) el.userName.textContent = username || 'User';
        syncRangeButtons();
        startDashboard();
    }

    if (el.logoutBtn) {
        el.logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(CONFIG.sessionKey);
            location.reload();
        });
    }

    if (el.tabsNav) {
        el.tabsNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            const tab = btn.dataset.tab;
            activateTab(tab);
        });
    }

    function activateTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
        const tabBtn = document.querySelector(`.tab-btn[data-tab=\"${tab}\"]`);
        if (tabBtn) tabBtn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
        const target = document.getElementById('tab-' + tab);
        if (target) target.classList.add('active');
        scheduleFit();
    }

    function syncRangeButtons() {
        if (!el.rangeSelector) return;
        el.rangeSelector.querySelectorAll('.range-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.range === _selectedRange);
        });
    }

    if (el.rangeSelector) {
        el.rangeSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.range-btn');
            if (!btn) return;
            const range = btn.dataset.range;
            if (!RANGE_LABEL[range]) return;
            _selectedRange = range;
            localStorage.setItem(CONFIG.rangeKey, _selectedRange);
            syncRangeButtons();
            if (_lastPayload) renderAll(_lastPayload);
            scheduleFit();
        });
    }

    if (el.dbAlertsList) {
        el.dbAlertsList.addEventListener('click', (e) => {
            const card = e.target.closest('.alert-item');
            if (!card) return;
            _selectedAlertKey = card.dataset.key || null;
            if (_lastPayload) renderAlertsTab(_lastPayload);
        });
    }

    if (el.alertsSummaryBadge) {
        el.alertsSummaryBadge.style.cursor = 'pointer';
        el.alertsSummaryBadge.addEventListener('click', () => activateTab('alerts'));
    }

    function showToast(message, type = 'info') {
        if (!el.toast) return;
        el.toast.textContent = message;
        el.toast.className = 'toast show ' + type;
        setTimeout(() => { el.toast.className = 'toast'; }, 2500);
    }

    const chartInstances = {};

    function getChartColors() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return {
            gridColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
            tickColor: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.5)',
            cpu: '#00d4ff',
            mem: '#7c3aed',
            disk: '#f59e0b',
            netUp: '#00d4ff',
            netDown: '#10b981',
            dbLoad: '#f97316',
            dbConn: '#38bdf8',
            dbQps: '#10b981',
            dbTps: '#22d3ee',
            dbSlow: '#ef4444',
        };
    }

    function chartDefaults() {
        const c = getChartColors();
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { labels: { color: c.tickColor, font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 14 } },
                tooltip: {
                    backgroundColor: 'rgba(10,10,20,0.9)',
                    titleFont: { family: 'Inter' },
                    bodyFont: { family: 'Inter' },
                    borderColor: 'rgba(0,212,255,0.2)',
                    borderWidth: 1,
                },
            },
            scales: {
                x: { grid: { color: c.gridColor }, ticks: { color: c.tickColor, font: { family: 'Inter', size: 11 }, maxRotation: 0 } },
                y: { grid: { color: c.gridColor }, ticks: { color: c.tickColor, font: { family: 'Inter', size: 11 } }, beginAtZero: true },
            },
        };
    }

    function makeOrUpdate(id, type, data, options) {
        if (chartInstances[id]) chartInstances[id].destroy();
        const canvas = document.getElementById(id);
        if (!canvas) return;
        chartInstances[id] = new Chart(canvas.getContext('2d'), { type, data, options });
    }

    function renderGauge(canvasId, valueId, subId, percent, subText, color) {
        const value = Number(percent) || 0;
        const valEl = document.getElementById(valueId);
        const subEl = document.getElementById(subId);
        if (valEl) valEl.textContent = value.toFixed(1) + '%';
        if (subEl) subEl.textContent = subText;
        const c = getChartColors();
        makeOrUpdate(canvasId, 'doughnut', {
            datasets: [{
                data: [value, Math.max(0, 100 - value)],
                backgroundColor: [color, c.gridColor],
                borderWidth: 0,
                cutout: '78%',
            }]
        }, {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { animateRotate: true, duration: 500 },
        });
    }

    function rangeHistory(data) {
        const h = data.history || {};
        if (Array.isArray(h[_selectedRange])) return h[_selectedRange];
        if (_selectedRange === '1h') return (data.history_1h || (data.history_24h || []).slice(-12) || []);
        if (_selectedRange === '24h') return data.history_24h || [];
        return data.history_7d || [];
    }

    function rangeDbHistory(data) {
        const db = data.db || {};
        const h = db.history || {};
        return Array.isArray(h[_selectedRange]) ? h[_selectedRange] : [];
    }

    function bucketLabel(bucket) {
        const value = String(bucket || '');
        if (!value) return '';
        if (_selectedRange === '7d') return value.substring(5, 16).replace('T', ' ');
        return value.substring(11, 16);
    }

    function labelWindow() {
        return RANGE_LABEL[_selectedRange] || '24h';
    }

    function setText(id, text) {
        const node = document.getElementById(id);
        if (node) node.textContent = text;
    }

    function dbUptime(seconds) {
        const s = Number(seconds) || 0;
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h ${m}m`;
    }

    function formatDuration(seconds) {
        const s = Number(seconds) || 0;
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h ${m}m`;
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString('pt-PT');
    }

    function describeAlert(key) {
        const hints = {
            cpu_high: 'CPU acima do limite. Processos concorrentes podem degradar o servidor e atrasar o collector.',
            ram_high: 'RAM alta. Pode provocar swap e lentidão geral; verificar processos que estão a consumir memória.',
            disk_high: 'Disco perto do limite. Risco de falhas em escrita de logs/export e problemas no sistema.',
            db_threads_running_high: 'Demasiadas queries em execução no MariaDB. Pode indicar contenção de recursos ou queries lentas.',
            db_slow_qps_high: 'Taxa de queries lentas acima do esperado. Rever índices, queries pesadas e picos de carga.',
        };
        return hints[key] || 'Alerta de monitorização ativo.';
    }

    function renderDbHealth(alerts) {
        const firing = alerts.filter(a => a.status === 'firing');
        const critical = firing.filter(a => a.severity === 'critical');
        const warning = firing.filter(a => a.severity === 'warning');
        if (!el.dbHealthPill || !el.dbHealthNote) return;
        el.dbHealthPill.classList.remove('ok', 'warn', 'critical');
        if (critical.length) {
            el.dbHealthPill.classList.add('critical');
            el.dbHealthPill.textContent = 'Crítico';
            el.dbHealthNote.textContent = `${critical.length} alerta(s) crítico(s) ativo(s). Intervenção recomendada já.`;
            return;
        }
        if (warning.length) {
            el.dbHealthPill.classList.add('warn');
            el.dbHealthPill.textContent = 'Atenção';
            el.dbHealthNote.textContent = `${warning.length} alerta(s) de aviso ativo(s). Acompanhar tendência.`;
            return;
        }
        el.dbHealthPill.classList.add('ok');
        el.dbHealthPill.textContent = 'Saudável';
        el.dbHealthNote.textContent = 'Sem alertas de risco no momento.';
    }

    function renderAlertDetail(alert, history) {
        if (!el.alertDetailPanel) return;
        if (!alert) {
            el.alertDetailPanel.innerHTML = '<div class=\"alert-empty\">Selecione um alerta para ver o detalhe.</div>';
            return;
        }
        const sevClass = alert.status === 'firing' ? alert.severity : 'resolved';
        const recent = history.filter(item => item.key === alert.key).slice(0, 5);
        const recentHtml = recent.length
            ? recent.map(item => `<div class=\"alert-meta\">${formatDateTime(item.sent_at)} | ${item.notification || item.status} | valor=${item.value ?? '—'}</div>`).join('')
            : '<div class=\"alert-meta\">Sem histórico recente para este alerta.</div>';
        el.alertDetailPanel.innerHTML = `
            <div class=\"alert-detail-title\">${alert.title}</div>
            <span class=\"alert-detail-severity ${sevClass}\">${alert.status} · ${alert.severity}</span>
            <div class=\"alert-detail-grid\">
                <div class=\"alert-detail-field\"><strong>Valor:</strong> ${alert.value}</div>
                <div class=\"alert-detail-field\"><strong>Limite:</strong> ${alert.threshold}</div>
                <div class=\"alert-detail-field\"><strong>Última avaliação:</strong> ${formatDateTime(alert.evaluated_at)}</div>
                <div class=\"alert-detail-field\"><strong>Chave:</strong> ${alert.key}</div>
            </div>
            <div class=\"alert-detail-help\">${describeAlert(alert.key)}</div>
            <div class=\"alert-detail-help\"><strong>Últimos eventos deste alerta:</strong></div>
            ${recentHtml}
        `;
    }

    function renderAlertHistory(history, selectedKey) {
        if (!el.alertHistoryList) return;
        const filtered = history.filter(item => {
            if (selectedKey && item.key !== selectedKey) return false;
            return item.severity === 'warning' || item.severity === 'critical';
        });
        if (!filtered.length) {
            el.alertHistoryList.innerHTML = '<div class=\"alert-empty\">Sem warnings/críticos no histórico recente.</div>';
            return;
        }
        el.alertHistoryList.innerHTML = filtered.slice(0, 60).map(item => `
            <div class=\"alert-history-item ${item.severity}\">
                <div class=\"alert-history-head\">
                    <span>${item.title || item.key || 'alerta'}</span>
                    <span class=\"alert-history-tag ${item.severity}\">${item.severity}</span>
                </div>
                <div class=\"alert-history-meta\">
                    ${formatDateTime(item.sent_at)} | ${item.notification || item.status} | valor=${item.value ?? '—'} | limite=${item.threshold ?? '—'}
                </div>
            </div>
        `).join('');
    }

    let _lastPayload = null;

    function renderOverview(data) {
        const cur = data.current || {};
        const c = getChartColors();
        const host = cur.host || {};

        renderGauge('gaugeCpu', 'gaugeCpuVal', 'gaugeCpuSub', cur.cpu?.total_percent || 0, (cur.cpu?.cores || '—') + ' cores', c.cpu);
        renderGauge('gaugeRam', 'gaugeRamVal', 'gaugeRamSub', cur.memory?.percent || 0, `${cur.memory?.used_gb ?? '—'} / ${cur.memory?.total_gb ?? '—'} GB`, c.mem);
        renderGauge('gaugeDisk', 'gaugeDiskVal', 'gaugeDiskSub', cur.disk?.percent || 0, `${cur.disk?.used_gb ?? '—'} / ${cur.disk?.total_gb ?? '—'} GB`, c.disk);

        setText('netUp', (Number(cur.network?.upload_mbps) || 0).toFixed(2));
        setText('netDown', (Number(cur.network?.download_mbps) || 0).toFixed(2));
        setText('gaugeNetSub', 'Pacotes: ' + (((cur.network?.packets_sent || 0) + (cur.network?.packets_recv || 0)).toLocaleString()));

        const db = data.db?.current || {};
        setText('dbThreadsRunning', String(db.threads_running ?? 0));
        setText('dbQps', (Number(db.qps) || 0).toFixed(3));
        setText('dbTps', (Number(db.tps) || 0).toFixed(3));
        setText('dbSlowQps', (Number(db.slow_qps) || 0).toFixed(3));

        setText('sysHostName', host.hostname || host.fqdn || '—');
        const osText = [host.os, host.platform].filter(Boolean).join(' · ');
        setText('sysOsName', osText || '—');
        setText('sysKernel', host.os_release || '—');
        setText('sysHostUptime', formatDuration(host.system_uptime_seconds));

        setText('overviewHostTitle', `CPU & Memória (${labelWindow()})`);
        setText('overviewNetTitle', `Rede (${labelWindow()})`);

        const hist = rangeHistory(data);
        if (hist.length) {
            const labels = hist.map(row => bucketLabel(row.bucket));
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            makeOrUpdate('chartOverview24h', 'line', {
                labels,
                datasets: [
                    { label: 'CPU %', data: hist.map(r => Number(r.cpu_avg) || 0), borderColor: c.cpu, backgroundColor: c.cpu + '20', fill: true, tension: 0.35, pointRadius: 0 },
                    { label: 'RAM %', data: hist.map(r => Number(r.mem_avg) || 0), borderColor: c.mem, backgroundColor: c.mem + '20', fill: true, tension: 0.35, pointRadius: 0 },
                ]
            }, defs);

            const netDefs = chartDefaults();
            netDefs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            makeOrUpdate('chartNet24h', 'line', {
                labels,
                datasets: [
                    { label: '↑ Upload', data: hist.map(r => Number(r.net_up_avg) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '20', fill: true, tension: 0.35, pointRadius: 0 },
                    { label: '↓ Download', data: hist.map(r => Number(r.net_down_avg) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '20', fill: true, tension: 0.35, pointRadius: 0 },
                ]
            }, netDefs);
        }
    }

    function renderCpuTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];

        if (rt.length) {
            const cpuData = rt.map(r => Number(r.cpu?.total_percent) || 0);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            defs.scales.x.display = false;
            defs.plugins.legend.display = false;
            makeOrUpdate('chartCpuLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [{ data: cpuData, borderColor: c.cpu, backgroundColor: c.cpu + '15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]
            }, defs);
            setText('cpuLiveBadge', (cpuData[cpuData.length - 1] || 0).toFixed(1) + '%');
        }

        const perCore = data.current?.cpu?.per_core || [];
        const grid = document.getElementById('coresGrid');
        if (grid) {
            grid.innerHTML = perCore.map((pct, i) => `
                <div class="core-bar">
                    <div class="core-bar-header">
                        <span class="core-bar-label">Core ${i}</span>
                        <span class="core-bar-value">${(Number(pct) || 0).toFixed(1)}%</span>
                    </div>
                    <div class="core-bar-track">
                        <div class="core-bar-fill" style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></div>
                    </div>
                </div>
            `).join('');
        }

        const hist = rangeHistory(data);
        if (hist.length) {
            setText('cpuHistoryTitle', `CPU — Histórico (${labelWindow()})`);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            makeOrUpdate('chartCpu7d', 'line', {
                labels: hist.map(r => bucketLabel(r.bucket)),
                datasets: [{ label: 'CPU %', data: hist.map(r => Number(r.cpu_avg) || 0), borderColor: c.cpu, backgroundColor: c.cpu + '15', fill: true, tension: 0.35, pointRadius: 0 }]
            }, defs);
        }
    }

    function renderMemoryTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];
        const m = data.current?.memory || {};

        setText('memTotal', `${m.total_gb ?? '—'} GB`);
        setText('memUsed', `${m.used_gb ?? '—'} GB`);
        setText('memFree', `${m.free_gb ?? '—'} GB`);
        setText('memSwap', `${m.swap_used_gb ?? '—'} / ${m.swap_total_gb ?? '—'} GB`);

        if (rt.length) {
            const memData = rt.map(r => Number(r.memory?.percent) || 0);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            defs.scales.x.display = false;
            defs.plugins.legend.display = false;
            makeOrUpdate('chartMemLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [{ data: memData, borderColor: c.mem, backgroundColor: c.mem + '15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]
            }, defs);
            setText('memLiveBadge', (memData[memData.length - 1] || 0).toFixed(1) + '%');
        }

        const hist = rangeHistory(data);
        if (hist.length) {
            setText('memHistoryTitle', `Memória — Histórico (${labelWindow()})`);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            makeOrUpdate('chartMem7d', 'line', {
                labels: hist.map(r => bucketLabel(r.bucket)),
                datasets: [{ label: 'RAM %', data: hist.map(r => Number(r.mem_avg) || 0), borderColor: c.mem, backgroundColor: c.mem + '15', fill: true, tension: 0.35, pointRadius: 0 }]
            }, defs);
        }
    }

    function renderDiskTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];
        const d = data.current?.disk || {};

        setText('diskTotal', `${d.total_gb ?? '—'} GB`);
        setText('diskUsed', `${d.used_gb ?? '—'} GB`);
        setText('diskFree', `${d.free_gb ?? '—'} GB`);
        setText('diskPercent', `${d.percent ?? '—'}%`);

        makeOrUpdate('chartDiskSpace', 'doughnut', {
            labels: ['Usado', 'Livre'],
            datasets: [{
                data: [Number(d.used_gb) || 0, Number(d.free_gb) || 0],
                backgroundColor: [c.disk, c.gridColor],
                borderWidth: 0,
                cutout: '65%',
            }]
        }, {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: c.tickColor, font: { family: 'Inter' } } },
                tooltip: { backgroundColor: 'rgba(10,10,20,0.9)' }
            },
        });

        if (rt.length) {
            const defs = chartDefaults();
            defs.scales.x.display = false;
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' MB/s';
            makeOrUpdate('chartDiskIo', 'line', {
                labels: rt.map(() => ''),
                datasets: [
                    { label: 'Read MB/s', data: rt.map(r => Number(r.disk?.read_mb_s) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Write MB/s', data: rt.map(r => Number(r.disk?.write_mb_s) || 0), borderColor: c.disk, backgroundColor: c.disk + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            }, defs);
        }
    }

    function renderNetworkTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];
        const n = data.current?.network || {};

        setText('netUpInfo', (Number(n.upload_mbps) || 0).toFixed(3) + ' Mbps');
        setText('netDownInfo', (Number(n.download_mbps) || 0).toFixed(3) + ' Mbps');
        setText('netPktSent', (Number(n.packets_sent) || 0).toLocaleString());
        setText('netPktRecv', (Number(n.packets_recv) || 0).toLocaleString());

        if (rt.length) {
            const defs = chartDefaults();
            defs.scales.x.display = false;
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            makeOrUpdate('chartNetLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [
                    { label: '↑ Upload', data: rt.map(r => Number(r.network?.upload_mbps) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: '↓ Download', data: rt.map(r => Number(r.network?.download_mbps) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            }, defs);
        }

        const hist = rangeHistory(data);
        if (hist.length) {
            setText('netHistoryTitle', `Rede — Histórico (${labelWindow()})`);
            const defs = chartDefaults();
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            makeOrUpdate('chartNet7d', 'line', {
                labels: hist.map(r => bucketLabel(r.bucket)),
                datasets: [
                    { label: '↑ Upload', data: hist.map(r => Number(r.net_up_avg) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '15', fill: true, tension: 0.35, pointRadius: 0 },
                    { label: '↓ Download', data: hist.map(r => Number(r.net_down_avg) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.35, pointRadius: 0 },
                ]
            }, defs);
        }
    }

    function renderDbTab(data) {
        const c = getChartColors();
        const db = data.db?.current || {};
        const dbHist = rangeDbHistory(data);

        setText('dbThreadsRunningInfo', String(db.threads_running ?? 0));
        setText('dbThreadsConnectedInfo', String(db.threads_connected ?? 0));
        setText('dbQpsInfo', (Number(db.qps) || 0).toFixed(3));
        setText('dbTpsInfo', (Number(db.tps) || 0).toFixed(3));
        setText('dbSlowQpsInfo', (Number(db.slow_qps) || 0).toFixed(3));
        setText('dbUptimeInfo', dbUptime(db.uptime_seconds));

        setText('dbLoadTitle', `MariaDB Threads (${labelWindow()})`);
        setText('dbRatesTitle', `MariaDB Throughput (${labelWindow()})`);

        if (dbHist.length) {
            const labels = dbHist.map(r => bucketLabel(r.bucket));
            const defsLoad = chartDefaults();
            makeOrUpdate('chartDbLoad', 'line', {
                labels,
                datasets: [
                    { label: 'Threads Running', data: dbHist.map(r => Number(r.threads_running_avg) || 0), borderColor: c.dbLoad, backgroundColor: c.dbLoad + '20', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Threads Connected', data: dbHist.map(r => Number(r.threads_connected_avg) || 0), borderColor: c.dbConn, backgroundColor: c.dbConn + '20', fill: true, tension: 0.3, pointRadius: 0 },
                ],
            }, defsLoad);

            const defsRates = chartDefaults();
            defsRates.scales.y.ticks.callback = (v) => Number(v).toFixed(2);
            makeOrUpdate('chartDbRates', 'line', {
                labels,
                datasets: [
                    { label: 'QPS', data: dbHist.map(r => Number(r.qps_avg) || 0), borderColor: c.dbQps, backgroundColor: c.dbQps + '20', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'TPS', data: dbHist.map(r => Number(r.tps_avg) || 0), borderColor: c.dbTps, backgroundColor: c.dbTps + '20', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Slow QPS', data: dbHist.map(r => Number(r.slow_qps_avg) || 0), borderColor: c.dbSlow, backgroundColor: c.dbSlow + '20', fill: false, tension: 0.25, pointRadius: 0 },
                ],
            }, defsRates);
        }
    }

    function renderAlertsTab(data) {
        const alertsCurrent = (data.alerts?.current || []).filter(a => a && (a.severity === 'warning' || a.severity === 'critical'));
        const alertsFiring = alertsCurrent.filter(a => a.status === 'firing');
        const alertsHistory = Array.isArray(data.alerts?.history_recent) ? data.alerts.history_recent : [];

        renderDbHealth(alertsCurrent);

        if (el.dbAlertsList) {
            if (!alertsCurrent.length) {
                el.dbAlertsList.innerHTML = '<div class="alert-empty">Sem alertas monitorizados no momento.</div>';
                _selectedAlertKey = null;
            } else {
                if (!_selectedAlertKey || !alertsCurrent.some(a => a.key === _selectedAlertKey)) {
                    const fallback = alertsFiring[0] || alertsCurrent[0];
                    _selectedAlertKey = fallback ? fallback.key : null;
                }
                el.dbAlertsList.innerHTML = alertsCurrent.map(a => `
                    <div class="alert-item ${a.status} ${a.severity} ${a.key === _selectedAlertKey ? 'active' : ''}" data-key="${a.key}">
                        <div class="alert-title">${a.title}</div>
                        <div class="alert-meta">estado=${a.status} | valor=${a.value} | limite=${a.threshold} | severidade=${a.severity}</div>
                    </div>
                `).join('');
            }
        }

        const selectedAlert = alertsCurrent.find(a => a.key === _selectedAlertKey) || alertsCurrent[0] || null;
        renderAlertDetail(selectedAlert, alertsHistory);
        renderAlertHistory(alertsHistory, _selectedAlertKey);
    }

    function renderAlertSummary(data) {
        const summary = data.alerts?.summary || {};
        const total = Number(summary.firing_total) || 0;
        const critical = Number(summary.critical) || 0;
        const warning = Number(summary.warning) || 0;
        if (!el.alertsSummaryBadge) return;
        el.alertsSummaryBadge.classList.remove('warning', 'critical');
        if (critical > 0) el.alertsSummaryBadge.classList.add('critical');
        else if (warning > 0) el.alertsSummaryBadge.classList.add('warning');
        el.alertsSummaryBadge.textContent = `Alertas: ${total} (crit:${critical} warn:${warning})`;
    }

    function renderAll(data) {
        _lastPayload = data;
        renderOverview(data);
        renderCpuTab(data);
        renderMemoryTab(data);
        renderDiskTab(data);
        renderNetworkTab(data);
        renderDbTab(data);
        renderAlertsTab(data);
        renderAlertSummary(data);

        if (el.lastUpdated) {
            const ts = data.generated_at || data.current?.timestamp;
            if (ts) {
                const d = new Date(ts);
                el.lastUpdated.textContent = 'Atualizado: ' + d.toLocaleTimeString('pt-PT');
            }
        }
        if (el.statusText) el.statusText.textContent = 'Online';
        const dot = document.querySelector('.status-dot');
        if (dot) {
            dot.classList.add('online');
            dot.classList.remove('offline');
        }
        scheduleFit();
    }

    let _fitTimer = null;
    function fitActiveTab() {
        const main = document.querySelector('.main-content');
        const active = document.querySelector('.tab-content.active');
        if (!main || !active) return;
        active.style.setProperty('--tab-scale', '1');
        const navH = el.tabsNav ? el.tabsNav.offsetHeight : 0;
        const toolbar = document.querySelector('.toolbar-row');
        const toolbarH = toolbar ? toolbar.offsetHeight : 0;
        const available = Math.max(220, main.clientHeight - navH - toolbarH - 8);
        const natural = active.scrollHeight || 0;
        if (!natural) return;
        const scale = Math.max(0.45, Math.min(1, available / natural));
        active.style.setProperty('--tab-scale', scale.toFixed(4));
    }

    function scheduleFit() {
        if (_fitTimer) clearTimeout(_fitTimer);
        _fitTimer = setTimeout(() => {
            fitActiveTab();
            requestAnimationFrame(fitActiveTab);
        }, 40);
    }

    let refreshTimer = null;

    async function fetchPayload() {
        try {
            const resp = await fetch(CONFIG.payloadUrl + '?t=' + Date.now());
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            renderAll(data);
        } catch (err) {
            console.error('Fetch error:', err);
            if (el.statusText) el.statusText.textContent = 'Offline';
            const dot = document.querySelector('.status-dot');
            if (dot) {
                dot.classList.remove('online');
                dot.classList.add('offline');
            }
        }
    }

    function startDashboard() {
        fetchPayload();
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(fetchPayload, CONFIG.refreshInterval);
    }

    if (el.refreshBtn) {
        el.refreshBtn.addEventListener('click', () => {
            el.refreshBtn.classList.add('spinning');
            fetchPayload().then(() => {
                showToast('Dados atualizados', 'success');
                setTimeout(() => el.refreshBtn.classList.remove('spinning'), 700);
            });
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.user-dropdown').forEach(dd => {
                dd.style.opacity = '0';
                dd.style.visibility = 'hidden';
            });
        }
    });

    window.addEventListener('resize', scheduleFit);

    initTheme();
    if (el.currentYear) el.currentYear.textContent = new Date().getFullYear();
    checkSession();
})();
