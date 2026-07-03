import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4100";
const tokenKey = "enterprise-timesheet-token";
const app = document.getElementById("app");

let state = {
  token: localStorage.getItem(tokenKey),
  user: null,
  employees: [],
  timesheets: [],
  dashboard: null,
  view: "dashboard",
  selectedDate: new Date().toISOString().slice(0, 10),
  loading: false,
  message: ""
};

const adminNav = [
  ["dashboard", "bi-speedometer2", "Dashboard"],
  ["home", "bi-house-door", "Home"],
  ["timesheet", "bi-calendar-check", "Timesheet"],
  ["reports", "bi-file-earmark-bar-graph", "Reports"],
  ["attendance", "bi-clock-history", "Attendance"],
  ["calendar", "bi-calendar3", "Calendar"],
  ["notifications", "bi-bell", "Notifications"],
  ["settings", "bi-sliders", "Settings"]
];
const employeeNav = [["timesheet", "bi-calendar-check", "Timesheet"]];

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) },
    credentials: "include"
  });
  if (!response.ok) throw new Error((await response.json()).message || "Request failed");
  return response.json();
}

function setMessage(message) {
  state.message = message;
  render();
  if (message) setTimeout(() => { state.message = ""; render(); }, 2600);
}

async function loadApp() {
  if (!state.token) return renderLogin();
  try {
    state.loading = true;
    const me = await api("/api/auth/me");
    state.user = me.user;
    state.view = state.user.role === "admin" ? state.view : "timesheet";
    await refreshData();
  } catch {
    localStorage.removeItem(tokenKey);
    state.token = null;
    state.user = null;
  } finally {
    state.loading = false;
    render();
  }
}

async function refreshData() {
  const requests = [api("/api/employees"), api("/api/timesheets")];
  if (state.user?.role === "admin") requests.push(api("/api/reports/dashboard"));
  const [employees, timesheets, dashboard] = await Promise.all(requests);
  state.employees = employees;
  state.timesheets = timesheets;
  state.dashboard = dashboard || null;
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-card glass-card">
        <div class="brand-mark">ET</div>
        <p class="eyebrow">Enterprise IT timesheets</p>
        <h1>Secure Timesheet Management</h1>
        <p class="muted">Google-ready authentication, JWT sessions, role-based access, and protected employee reporting.</p>
        <form id="loginForm" class="vstack gap-3">
          <input class="form-control dark-input" name="email" type="email" value="admin@pulsedesk.test" placeholder="Email" required />
          <input class="form-control dark-input" name="password" type="password" value="password123" placeholder="Password" required />
          <button class="btn primary-btn" type="submit"><i class="bi bi-shield-lock"></i> Login with JWT</button>
        </form>
        <button id="googleLogin" class="btn google-btn w-100 mt-3" type="button"><span>G</span> Continue with Google</button>
        <div class="credential-box mt-4">
          <strong>Test accounts</strong>
          <p>Admin: admin@pulsedesk.test / password123</p>
          <p>Employee: employee@pulsedesk.test / password123</p>
        </div>
      </section>
    </main>`;
  document.getElementById("loginForm").addEventListener("submit", login);
  document.getElementById("googleLogin").addEventListener("click", googleLogin);
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
    state.token = result.token;
    localStorage.setItem(tokenKey, result.token);
    await loadApp();
  } catch (error) { setMessage(error.message); }
}

async function googleLogin() {
  try {
    const email = document.querySelector("[name='email']")?.value || "admin@pulsedesk.test";
    const result = await api("/api/auth/google", { method: "POST", body: JSON.stringify({ email, name: "Google User", role: "employee" }) });
    state.token = result.token;
    localStorage.setItem(tokenKey, result.token);
    await loadApp();
  } catch (error) { setMessage(error.message); }
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  localStorage.removeItem(tokenKey);
  state = { ...state, token: null, user: null, view: "dashboard" };
  renderLogin();
}

function render() {
  if (!state.token || !state.user) return renderLogin();
  const allowed = state.user.role === "admin" ? adminNav.map(([id]) => id) : ["timesheet"];
  if (!allowed.includes(state.view)) state.view = "timesheet";
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar glass-card">
        <div class="sidebar-brand"><span class="brand-mark small">ET</span><strong>PulseDesk</strong></div>
        <nav>${(state.user.role === "admin" ? adminNav : employeeNav).map(([id, icon, label]) => `<button class="nav-button ${state.view === id ? "active" : ""}" data-view="${id}"><i class="bi ${icon}"></i>${label}</button>`).join("")}</nav>
      </aside>
      <main class="main-panel">
        <header class="topbar glass-card">
          <div><p class="eyebrow mb-1">${state.user.role} workspace</p><h1>${pageTitle()}</h1></div>
          <div class="user-chip"><img src="${state.user.photo}" alt="${state.user.name}" /><span>${state.user.name}</span><button id="logoutBtn" class="btn icon-only"><i class="bi bi-box-arrow-right"></i></button></div>
        </header>
        ${state.message ? `<div class="alert glass-card">${state.message}</div>` : ""}
        ${viewMarkup()}
      </main>
    </div>`;
  bindPageEvents();
}

function pageTitle() {
  const item = [...adminNav, ...employeeNav].find(([id]) => id === state.view);
  return item?.[2] || "Timesheet";
}

function viewMarkup() {
  if (state.loading) return `<div class="skeleton-grid"><span></span><span></span><span></span></div>`;
  if (state.user.role !== "admin" && state.view !== "timesheet") return employeeDenied();
  const views = { dashboard, home, timesheet, reports, attendance, calendar, notifications, settings };
  return (views[state.view] || timesheet)();
}

function dashboard() {
  const d = state.dashboard || {};
  const stats = [
    ["Total Employees", d.totalEmployees || 0, "bi-people"], ["Active Employees", d.activeEmployees || 0, "bi-person-check"],
    ["Total Hours", d.totalWorkingHours || 0, "bi-hourglass-split"], ["Pending Reports", d.pendingReports || 0, "bi-inbox"],
    ["Approved", d.approvedReports || 0, "bi-check-circle"], ["Rejected", d.rejectedReports || 0, "bi-x-circle"]
  ];
  return `<section class="grid stats-grid">${stats.map(([label, value, icon]) => `<article class="stat-card glass-card"><i class="bi ${icon}"></i><span>${label}</span><strong>${value}</strong></article>`).join("")}</section>${employeeCards(true)}<section class="glass-card panel"><h2>Project Status</h2><div class="bar-list">${(d.projectStatus || []).map((p) => `<div><span>${p.project}</span><div class="bar"><b style="width:${Math.min(100, p.hours * 8)}%"></b></div><em>${p.hours}h</em></div>`).join("")}</div></section>`;
}

function home() { return `<section class="hero glass-card"><p class="eyebrow">Admin Home</p><h2>Enterprise Operations Center</h2><p>Manage employees, approve reports, review attendance, export reports, and monitor project delivery from one protected workspace.</p></section>${dashboard()}`; }
function employeeDenied() { return `<section class="glass-card panel"><h2>Access denied</h2><p class="muted">Employees can only access their own timesheet page.</p></section>`; }

function timesheet() {
  const employeeRows = state.user.role === "admin" ? employeeCards(false) : employeeCards(false, true);
  return `<section class="timesheet-layout"><div class="glass-card panel"><h2>Daily Timesheet</h2><form id="timesheetForm" class="entry-grid"><label>Date<input class="form-control dark-input" name="date" type="date" value="${state.selectedDate}" required /></label><label>Task Name<input class="form-control dark-input" name="task" required /></label><label>Project Name<input class="form-control dark-input" name="project" required /></label><label>Working Hours<input class="form-control dark-input" name="hours" type="number" min="0" max="24" step="0.25" required /></label><label>Break Time<input class="form-control dark-input" name="breakTime" type="number" min="0" max="8" step="0.25" value="0" /></label><label class="wide">Comments<textarea class="form-control dark-input" name="comments" rows="4"></textarea></label><button class="btn primary-btn wide" type="submit"><i class="bi bi-save"></i> Save Timesheet</button></form>${hourSummary()}</div><div>${calendarMarkup()}</div></section>${employeeRows}`;
}

function hourSummary() {
  const mine = state.user.role === "admin" ? state.timesheets : state.timesheets.filter((t) => t.userId === state.user.id);
  const month = state.selectedDate.slice(0, 7);
  const selected = new Date(state.selectedDate);
  const weekStart = new Date(selected); weekStart.setDate(selected.getDate() - selected.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekly = mine.filter((t) => new Date(t.date) >= weekStart && new Date(t.date) <= weekEnd).reduce((s, t) => s + Number(t.hours), 0);
  const monthly = mine.filter((t) => t.date.startsWith(month)).reduce((s, t) => s + Number(t.hours), 0);
  return `<div class="summary-row"><span>Total: ${mine.reduce((s, t) => s + Number(t.hours), 0)}h</span><span>Weekly: ${weekly}h</span><span>Monthly: ${monthly}h</span></div>`;
}

function calendarMarkup() {
  const date = new Date(`${state.selectedDate}T00:00:00`);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    const has = state.timesheets.some((t) => t.date === key);
    cells += `<button class="calendar-cell ${key === state.selectedDate ? "active" : ""}" data-date="${key}"><span>${day.toLocaleDateString(undefined, { weekday: "short" })}</span><strong>${day.getDate()}</strong><em>${day.toLocaleDateString(undefined, { month: "short" })}</em>${has ? "<i>Saved</i>" : ""}</button>`;
  }
  return `<section class="glass-card panel"><h2>${date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><div class="calendar-grid">${cells}</div></section>`;
}

function employeeCards(showActions = false, ownOnly = false) {
  const visible = ownOnly ? state.employees.filter((e) => e.employeeId === state.user.employeeId) : state.employees;
  return `<section class="employee-grid">${visible.map((employee) => {
    const today = state.timesheets.find((t) => t.employeeId === employee.employeeId && t.date === new Date().toISOString().slice(0, 10));
    return `<article class="employee-card glass-card"><header><img src="${employee.photo}" alt="${employee.name}" /><div><h3>${employee.name}</h3><p>${employee.employeeId} · ${employee.department}</p></div></header><dl><dt>Project</dt><dd>${employee.project}</dd><dt>Today's Task</dt><dd>${today?.task || "No task submitted"}</dd><dt>Hours</dt><dd>${today?.hours || 0}h</dd><dt>Status</dt><dd><span class="status ${today?.status || "pending"}">${today?.status || "pending"}</span></dd></dl>${showActions && today ? `<div class="actions"><button data-status="approved" data-id="${today.id}" class="btn soft-btn">Approve</button><button data-status="rejected" data-id="${today.id}" class="btn danger-btn">Reject</button></div>` : ""}</article>`;
  }).join("")}</section>`;
}

function reports() {
  return `<section class="glass-card panel"><div class="panel-head"><h2>Timesheet Reports</h2><button id="exportJson" class="btn soft-btn"><i class="bi bi-download"></i> Export JSON</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Employee</th><th>Project</th><th>Task</th><th>Hours</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.timesheets.map((t) => `<tr><td>${t.date}</td><td>${t.employeeId}</td><td>${t.project}</td><td>${t.task}</td><td>${t.hours}</td><td><span class="status ${t.status}">${t.status}</span></td><td><button class="mini" data-status="approved" data-id="${t.id}">Approve</button><button class="mini reject" data-status="rejected" data-id="${t.id}">Reject</button></td></tr>`).join("")}</tbody></table></div></section>`;
}
function attendance() { return `<section class="glass-card panel"><h2>Attendance Management</h2><p class="muted">Attendance API is protected for admins and ready for check-in/check-out integrations.</p></section>`; }
function calendar() { return calendarMarkup(); }
function notifications() { return `<section class="glass-card panel"><h2>Notifications</h2><p class="muted">Pending approvals: ${state.timesheets.filter((t) => t.status === "pending").length}</p></section>`; }
function settings() { return `<section class="glass-card panel"><h2>Admin Settings</h2><div class="settings-grid"><span>Company Settings</span><span>User Roles</span><span>Employee Creation</span><span>Department Management</span><span>Project Management</span><span>Theme Settings</span><span>Backup</span><span>Database Settings</span></div></section>`; }

function bindPageEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; render(); }));
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("timesheetForm")?.addEventListener("submit", saveTimesheet);
  document.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => { state.selectedDate = button.dataset.date; render(); }));
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => updateStatus(button.dataset.id, button.dataset.status)));
  document.getElementById("exportJson")?.addEventListener("click", async () => { const data = await api("/api/reports/export/json"); download("timesheet-export.json", JSON.stringify(data, null, 2)); });
}

async function saveTimesheet(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  data.hours = Number(data.hours);
  data.breakTime = Number(data.breakTime || 0);
  try { await api("/api/timesheets", { method: "POST", body: JSON.stringify(data) }); await refreshData(); setMessage("Timesheet saved successfully"); } catch (error) { setMessage(error.message); }
}
async function updateStatus(id, status) {
  try { await api(`/api/timesheets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await refreshData(); setMessage(`Report ${status}`); } catch (error) { setMessage(error.message); }
}
function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

loadApp();
