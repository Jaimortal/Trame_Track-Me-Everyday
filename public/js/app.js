/**
 * app.js - Core application logic for TRAME (Track & Me)
 * Handles Yearly Calendar, Animated Bookmark Slideshows, Tracker Modal, and PDF Reports
 */

class TrameApp {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.todayStr = this.formatDateIso(new Date());
    this.tasks = [];
    this.selectedDate = this.todayStr;
    this.editingTaskId = null;
    this.slideshowTimers = [];

    // DOM Elements
    this.calendarContainer = document.getElementById('yearCalendarContainer');
    this.yearDisplay = document.getElementById('currentYearDisplay');
    this.monthLinks = document.getElementById('monthQuickLinks');
    
    // Tracker Modal Elements
    this.trackerModal = document.getElementById('trackerModal');
    this.trackerModalCard = document.getElementById('trackerModalCard');
    this.trackerDateBadge = document.getElementById('trackerDateBadge');
    this.trackerDateSubtext = document.getElementById('trackerDateSubtext');
    this.tabBtnViewTasks = document.getElementById('tabBtnViewTasks');
    this.tabBtnAddTask = document.getElementById('tabBtnAddTask');
    this.tabTaskCount = document.getElementById('tabTaskCount');
    this.panelViewTasks = document.getElementById('panelViewTasks');
    this.taskListContainer = document.getElementById('taskListContainer');
    this.trackerForm = document.getElementById('trackerForm');
    this.taskEditId = document.getElementById('taskEditId');
    this.taskTargetDate = document.getElementById('taskTargetDate');
    this.taskTitle = document.getElementById('taskTitle');
    this.taskDescription = document.getElementById('taskDescription');
    this.taskTime = document.getElementById('taskTime');
    this.taskCategory = document.getElementById('taskCategory');
    this.taskLinkUrl = document.getElementById('taskLinkUrl');
    this.taskLinkLabel = document.getElementById('taskLinkLabel');
    
    // Completed Tasks Modal Elements
    this.completedModal = document.getElementById('completedModal');
    this.completedListContainer = document.getElementById('completedListContainer');
    this.completedYearFilter = document.getElementById('completedYearFilter');
    this.badgeCompletedCount = document.getElementById('badgeCompletedCount');

    this.init();
  }

  async init() {
    this.setupTheme();
    this.bindEvents();
    this.initCustomTimePicker();
    this.renderMonthNavLinks();
    
    // Initial data load from JSON database, Malaybalay weather & DB-stored dark mode
    await this.syncThemeFromDb();
    await this.loadWeather();
    await this.loadTasks();

    // Refresh weather every 10 minutes
    setInterval(() => this.loadWeather(), 10 * 60 * 1000);
  }

  // Formatting helper: YYYY-MM-DD
  formatDateIso(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Human friendly date string
  formatDateHuman(isoStr) {
    const [y, m, d] = isoStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // ISO Week Number calculator
  getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  // Theme Management (Light / Night Mode) - Synchronized with JSON database
  setupTheme() {
    const savedTheme = localStorage.getItem('trame-theme') || 'light';
    const isDark = savedTheme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    this.updateThemeIcon(isDark);
  }

  async syncThemeFromDb() {
    try {
      const settings = await API.getSettings();
      if (settings && settings.darkMode !== undefined) {
        const isDark = Boolean(settings.darkMode);
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('trame-theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark);
        if (window.weatherEngine) {
          window.weatherEngine.startCanvasAnimation();
        }
      }
    } catch (err) {
      console.warn('Could not sync theme from JSON DB:', err);
    }
  }

  async toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('trame-theme', isDark ? 'dark' : 'light');
    this.updateThemeIcon(isDark);
    if (window.weatherEngine) {
      window.weatherEngine.startCanvasAnimation();
    }
    // Persist to primary JSON database so it stays on what mode they left
    try {
      await API.updateSettings({ darkMode: isDark });
    } catch (err) {
      console.warn('Failed to save dark mode to JSON DB:', err);
    }
  }

  updateThemeIcon(isDark) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // Load Malaybalay City Weather
  async loadWeather() {
    try {
      const weatherData = await API.getWeather();
      if (weatherData && window.weatherEngine) {
        window.weatherEngine.updateHUD(weatherData);
      }
    } catch (err) {
      console.warn('Weather fetch failed:', err);
    }
  }

  // Load Tasks from primary JSON database
  async loadTasks() {
    try {
      this.tasks = await API.getTasks({ year: this.currentYear });
      this.renderYearCalendar();
      this.updateStats();
    } catch (err) {
      this.showToast('Failed to load tasks from JSON database', 'error');
    }
  }

  // Update summary metrics & JSON file size
  async updateStats() {
    try {
      const stats = await API.getStats();
      const elTotal = document.getElementById('statTotalTasks');
      const elPending = document.getElementById('statPendingTasks');
      const elCompleted = document.getElementById('statCompletedTasks');
      const elDbSize = document.getElementById('statDbSize');

      if (elTotal) elTotal.textContent = stats.total;
      if (elPending) elPending.textContent = stats.pending;
      if (elCompleted) elCompleted.textContent = stats.completed;
      if (this.badgeCompletedCount) this.badgeCompletedCount.textContent = stats.completed;
      if (elDbSize) {
        const kb = (stats.dbFileSize / 1024).toFixed(1);
        elDbSize.textContent = `${kb} KB`;
      }
    } catch (err) {
      console.error('Failed to update stats:', err);
    }
  }

  // Render Month Quick Jump links
  renderMonthNavLinks() {
    if (!this.monthLinks) return;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.monthLinks.innerHTML = months.map((m, idx) => `
      <button data-month-target="month-card-${idx}" class="month-pill-btn px-2.5 py-1 rounded-lg hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-slate-800 dark:hover:text-sky-400 text-slate-600 dark:text-slate-300 transition text-xs font-semibold">
        ${m}
      </button>
    `).join('');

    this.monthLinks.querySelectorAll('.month-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-month-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // Clear existing slideshow intervals
  clearSlideshowTimers() {
    this.slideshowTimers.forEach(id => clearInterval(id));
    this.slideshowTimers = [];
  }

  // Render all 12 months for the single scrollable yearly calendar
  renderYearCalendar() {
    this.clearSlideshowTimers();
    if (!this.calendarContainer) return;
    this.yearDisplay.textContent = this.currentYear;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let html = '';

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthDate = new Date(this.currentYear, monthIndex, 1);
      const totalDays = new Date(this.currentYear, monthIndex + 1, 0).getDate();
      
      // Calculate month activities count
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const monthTasks = this.tasks.filter(t => t.date && t.date.startsWith(`${this.currentYear}-${monthStr}`));
      const completedCount = monthTasks.filter(t => t.completed).length;

      html += `
        <section id="month-card-${monthIndex}" class="month-card rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-3 sm:p-6">
          
          <!-- Month Header -->
          <div class="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-5 pb-2 sm:pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold font-display text-xs sm:text-sm shadow-md">
                ${monthStr}
              </div>
              <div>
                <h2 class="text-base sm:text-xl font-bold font-display text-slate-900 dark:text-white">
                  ${monthNames[monthIndex]} <span class="text-slate-400 font-normal text-xs sm:text-sm">${this.currentYear}</span>
                </h2>
                <p class="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                  ${totalDays} Days &bull; ${monthTasks.length} Activities Booked
                </p>
              </div>
            </div>

            <!-- Month completion pill -->
            <div class="flex items-center gap-2">
              <span class="text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5">
                <i data-lucide="check-check" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500"></i>
                <span>${completedCount} / ${monthTasks.length} Done</span>
              </span>
            </div>
          </div>

          <!-- Calendar Grid Table (Stacked weekly layout, Responsive & Fixed Column Widths) -->
          <div class="overflow-x-auto w-full">
            <div class="w-full min-w-0">
              
              <!-- Week Day Column Headers (No "Wk" on mobile view) -->
              <div class="grid grid-cols-7 sm:grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1 sm:gap-2 mb-1.5 text-center text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <div class="py-1 hidden sm:block">Wk</div>
                <div class="py-0.5 sm:py-1 text-slate-600 dark:text-slate-400">Mon</div>
                <div class="py-0.5 sm:py-1 text-slate-600 dark:text-slate-400">Tue</div>
                <div class="py-0.5 sm:py-1 text-slate-600 dark:text-slate-400">Wed</div>
                <div class="py-0.5 sm:py-1 text-slate-600 dark:text-slate-400">Thu</div>
                <div class="py-0.5 sm:py-1 text-slate-600 dark:text-slate-400">Fri</div>
                <div class="py-0.5 sm:py-1 text-amber-600 dark:text-amber-400">Sat</div>
                <div class="py-0.5 sm:py-1 text-rose-600 dark:text-rose-400">Sun</div>
              </div>

              <!-- Week Rows Stacked Bellow -->
              <div class="space-y-1 sm:space-y-2">
                ${this.renderMonthWeeks(this.currentYear, monthIndex, totalDays)}
              </div>

            </div>
          </div>

        </section>
      `;
    }

    this.calendarContainer.innerHTML = html;
    
    // Refresh icons
    if (window.lucide) window.lucide.createIcons();

    // Bind click events on date cells
    this.calendarContainer.querySelectorAll('.calendar-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const date = e.currentTarget.getAttribute('data-date');
        if (date) {
          this.openTrackerModal(date);
        }
      });
    });

    // Start all bookmark slideshow carousels for dates with multiple tasks
    this.initBookmarkSlideshows();
  }

  // Generates stacked week rows for a specific month
  renderMonthWeeks(year, monthIndex, totalDays) {
    let rowsHtml = '';
    
    // First day of month (0 = Sun, 1 = Mon... 6 = Sat)
    // Convert so Monday is 0, Sunday is 6
    const firstDay = new Date(year, monthIndex, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    let currentDay = 1;
    let currentWeekNum = this.getWeekNumber(new Date(year, monthIndex, 1));

    while (currentDay <= totalDays) {
      let cellsHtml = '';

      for (let dayCol = 0; dayCol < 7; dayCol++) {
        if ((currentDay === 1 && dayCol < startDayOfWeek) || currentDay > totalDays) {
          // Empty padding cell
          cellsHtml += `
            <div class="calendar-cell rounded-2xl border border-dashed border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-900/20 opacity-30 pointer-events-none"></div>
          `;
        } else {
          // Valid day cell
          const dayDate = new Date(year, monthIndex, currentDay);
          const isoDate = this.formatDateIso(dayDate);
          const isToday = isoDate === this.todayStr;
          
          // Get tasks for this date (only active / incomplete tasks are shown on calendar dates)
          const dayTasks = this.tasks.filter(t => t.date === isoDate && !t.completed);
          
          cellsHtml += `
            <div data-date="${isoDate}" class="calendar-cell rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-1 sm:p-2.5 flex flex-col justify-between cursor-pointer group shadow-sm ${isToday ? 'is-today' : ''}">
              
              <!-- Date Header Number -->
              <div class="flex items-center justify-between mb-0.5 sm:mb-1">
                <span class="text-[10px] sm:text-xs font-bold font-display ${isToday ? 'text-white bg-sky-600 px-1 py-0.2 rounded-full' : 'text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400'}">
                  ${currentDay}
                </span>

                <!-- Quick Action Plus Icon (Desktop only) -->
                <button title="Add task to ${isoDate}" class="hidden sm:block opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-sky-50 text-sky-600 dark:text-sky-400 dark:hover:bg-slate-700 transition">
                  <i data-lucide="plus" class="w-3 h-3"></i>
                </button>
              </div>

              <!-- Bookmark Display Container -->
              <div class="flex-1 flex flex-col justify-end mt-0.5">
                ${this.renderDateBookmarks(dayTasks, isoDate)}
              </div>

            </div>
          `;

          // Track week number of current day
          currentWeekNum = this.getWeekNumber(dayDate);
          currentDay++;
        }
      }

      // Wrap in week row (No "Wk" column on mobile view)
      rowsHtml += `
        <div class="grid grid-cols-7 sm:grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1 sm:gap-2 items-stretch">
          <div class="week-num-badge hidden sm:flex" title="Week ${currentWeekNum}">
            ${currentWeekNum}
          </div>
          ${cellsHtml}
        </div>
      `;
    }

    return rowsHtml;
  }

  // Renders the bookmark design or animated slideshow for a date
  renderDateBookmarks(dayTasks, dateStr) {
    if (!dayTasks || dayTasks.length === 0) {
      return `
        <div class="h-6 sm:h-8 flex items-center justify-center text-[8px] sm:text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-slate-400">
          <span class="opacity-0 group-hover:opacity-100 transition">+</span>
        </div>
      `;
    }

    // Single Task on Date: Render stylish bookmark ribbon
    if (dayTasks.length === 1) {
      const task = dayTasks[0];
      const priorityClass = `priority-${task.priority || 'medium'}`;
      const completedClass = task.completed ? 'is-completed line-through' : '';

      return `
        <div class="bookmark-ribbon ${priorityClass} ${completedClass} flex items-center justify-between gap-0.5 sm:gap-1 w-full min-w-0" title="${this.escapeHtml(task.title)}">
          <div class="flex items-center gap-1 min-w-0 flex-1 truncate">
            <i data-lucide="${task.completed ? 'check-circle' : 'bookmark'}" class="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${task.completed ? 'text-emerald-500 fill-emerald-500' : 'fill-current'}"></i>
            <span class="font-bold truncate text-[9px] sm:text-[11px] block min-w-0">${this.escapeHtml(task.title)}</span>
          </div>
          ${task.time ? `<span class="hidden md:inline text-[8px] sm:text-[9px] font-semibold opacity-75 shrink-0">${task.time}</span>` : ''}
        </div>
      `;
    }

    // Multiple Tasks on Date: Render Animated Bookmark Slideshow Carousel!
    const slidesHtml = dayTasks.map((task, idx) => {
      const priorityClass = `priority-${task.priority || 'medium'}`;
      const completedClass = task.completed ? 'is-completed line-through' : '';

      return `
        <div class="slideshow-slide ${idx === 0 ? 'active-slide' : ''} w-full min-w-0" data-slide-index="${idx}">
          <div class="bookmark-ribbon ${priorityClass} ${completedClass} flex items-center justify-between gap-0.5 sm:gap-1 w-full min-w-0" title="${this.escapeHtml(task.title)}">
            <div class="flex items-center gap-1 min-w-0 flex-1 truncate">
              <i data-lucide="${task.completed ? 'check-circle' : 'bookmark'}" class="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${task.completed ? 'text-emerald-500 fill-emerald-500' : 'fill-current'}"></i>
              <span class="font-bold truncate text-[9px] sm:text-[11px] block min-w-0">${this.escapeHtml(task.title)}</span>
            </div>
            ${task.time ? `<span class="hidden md:inline text-[8px] sm:text-[9px] font-semibold opacity-75 shrink-0">${task.time}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const dotsHtml = dayTasks.map((_, idx) => `
      <span class="slideshow-dot ${idx === 0 ? 'active' : ''}" data-dot-index="${idx}"></span>
    `).join('');

    return `
      <div class="slideshow-container w-full min-w-0" data-slideshow-date="${dateStr}">
        ${slidesHtml}
        <div class="slideshow-dots">
          ${dotsHtml}
        </div>
      </div>
    `;
  }

  // Initializes automated sliding tickers on dates with multiple tasks
  initBookmarkSlideshows() {
    const containers = this.calendarContainer.querySelectorAll('.slideshow-container');
    
    containers.forEach((container, cIdx) => {
      const slides = container.querySelectorAll('.slideshow-slide');
      const dots = container.querySelectorAll('.slideshow-dot');
      if (slides.length <= 1) return;

      let currentIdx = 0;
      // Stagger intervals slightly so all slideshows don't jump simultaneously
      const intervalDuration = 3200 + (cIdx % 5) * 200;

      const timerId = setInterval(() => {
        // Remove active class from current
        slides[currentIdx].classList.remove('active-slide');
        if (dots[currentIdx]) dots[currentIdx].classList.remove('active');

        // Increment
        currentIdx = (currentIdx + 1) % slides.length;

        // Add active class to next
        slides[currentIdx].classList.add('active-slide');
        if (dots[currentIdx]) dots[currentIdx].classList.add('active');
      }, intervalDuration);

      this.slideshowTimers.push(timerId);
    });
  }

  // ==========================================================
  // TRACKER MODAL LOGIC (View, Add, Edit, Delete, Customized Link)
  // ==========================================================

  openTrackerModal(dateStr, openAddTab = false) {
    this.selectedDate = dateStr;
    this.taskTargetDate.value = dateStr;
    this.trackerDateBadge.textContent = this.formatDateHuman(dateStr);
    
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekNum = this.getWeekNumber(dateObj);
    this.trackerDateSubtext.textContent = `Week ${weekNum} of ${y} • Primary Database: JSON`;

    // Only active (incomplete) tasks are shown on this specific date
    const dayTasks = this.tasks.filter(t => t.date === dateStr && !t.completed);
    this.tabTaskCount.textContent = dayTasks.length;

    this.renderDayTaskList(dayTasks);

    // If no active tasks exist on this date yet, or openAddTab is true, show form directly
    if (dayTasks.length === 0 || openAddTab) {
      this.switchTrackerTab('add');
      this.resetTaskForm();
    } else {
      this.switchTrackerTab('view');
    }

    // Lock background scroll and pause background animation
    document.body.classList.add('modal-open');
    if (window.weatherEngine) window.weatherEngine.pause();

    // Instantaneous modal reveal without delay
    this.trackerModal.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.trackerModal.classList.remove('opacity-0');
      this.trackerModalCard.classList.remove('scale-95');
    });
  }

  closeTrackerModal() {
    this.trackerModalCard.classList.add('scale-95');
    this.trackerModal.classList.add('opacity-0');
    setTimeout(() => {
      this.trackerModal.classList.add('hidden');
      this.resetTaskForm();
      document.body.classList.remove('modal-open');
      if (window.weatherEngine) window.weatherEngine.resume();
    }, 120);
  }

  switchTrackerTab(tab) {
    if (tab === 'view') {
      this.tabBtnViewTasks.className = 'pb-2.5 border-b-2 border-sky-600 text-sky-600 dark:text-sky-400 flex items-center gap-1.5 transition';
      this.tabBtnAddTask.className = 'pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition';
      this.panelViewTasks.classList.remove('hidden');
      this.trackerForm.classList.add('hidden');
    } else {
      this.tabBtnAddTask.className = 'pb-2.5 border-b-2 border-sky-600 text-sky-600 dark:text-sky-400 flex items-center gap-1.5 transition';
      this.tabBtnViewTasks.className = 'pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition';
      this.panelViewTasks.classList.add('hidden');
      this.trackerForm.classList.remove('hidden');
    }
  }

  // Renders the list of activities on the selected date
  renderDayTaskList(dayTasks) {
    if (!this.taskListContainer) return;

    if (!dayTasks || dayTasks.length === 0) {
      const completedOnDate = this.tasks.filter(t => t.date === this.selectedDate && t.completed).length;
      this.taskListContainer.innerHTML = `
        <div class="py-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <i data-lucide="${completedOnDate > 0 ? 'check-circle-2' : 'calendar-plus'}" class="w-8 h-8 mx-auto ${completedOnDate > 0 ? 'text-emerald-500/70' : 'opacity-50'}"></i>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">
            ${completedOnDate > 0 ? 'All activities for this date are completed!' : 'No activities recorded for this date yet.'}
          </p>
          ${completedOnDate > 0 ? `
            <p class="text-[11px] text-slate-400 dark:text-slate-500">
              Completed items (${completedOnDate}) can be reviewed in <button type="button" id="btnGoToCompletedModal" class="text-sky-600 dark:text-sky-400 underline font-semibold hover:opacity-80">Completed Tasks</button>.
            </p>
          ` : '<p class="text-[11px] text-slate-400">Click Add Activity to schedule a new task.</p>'}
        </div>
      `;
      const btnGo = this.taskListContainer.querySelector('#btnGoToCompletedModal');
      if (btnGo) {
        btnGo.addEventListener('click', () => {
          this.closeTrackerModal();
          this.openCompletedModal();
        });
      }
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    this.taskListContainer.innerHTML = dayTasks.map(task => {
      const isCompleted = task.completed;
      const priorityBadge = {
        urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
        high: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        medium: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
        low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }[task.priority || 'medium'];

      // Customized Link Button (no ugly long links displayed!)
      let linkButtonHtml = '';
      if (task.linkUrl) {
        const displayLabel = task.linkLabel && task.linkLabel.trim() ? task.linkLabel.trim() : 'Open Link';
        linkButtonHtml = `
          <a href="${task.linkUrl}" target="_blank" rel="noopener noreferrer" class="custom-link-pill mt-2" title="${task.linkUrl}">
            <i data-lucide="external-link" class="w-3 h-3"></i>
            <span>${this.escapeHtml(displayLabel)}</span>
          </a>
        `;
      }

      return `
        <div class="p-4 rounded-2xl border ${isCompleted ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80'} shadow-sm space-y-2 transition-all">
          
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              
              <!-- Checkbox button to toggle completed -->
              <button data-task-id="${task.id}" class="btn-toggle-task mt-0.5 w-5 h-5 rounded-lg border-2 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'} flex items-center justify-center transition shrink-0" title="Mark as ${isCompleted ? 'Incomplete' : 'Complete'}">
                <i data-lucide="check" class="w-3.5 h-3.5 ${isCompleted ? 'block' : 'hidden'}"></i>
              </button>

              <div>
                <h4 class="text-sm font-bold ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}">
                  ${this.escapeHtml(task.title)}
                </h4>
                ${task.description ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${this.escapeHtml(task.description)}</p>` : ''}
              </div>
            </div>

            <!-- Priority badge & Category -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityBadge} capitalize">
                ${task.priority || 'medium'}
              </span>
            </div>
          </div>

          <!-- Time deadline & Customized Link button -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
            <div class="flex items-center gap-3">
              ${task.time ? `
                <span class="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-sky-500"></i>
                  ${task.time} Deadline
                </span>
              ` : ''}
              <span class="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-600 dark:text-slate-300">
                ${task.category || 'General'}
              </span>
            </div>

            <!-- Action buttons: Edit, Delete -->
            <div class="flex items-center gap-1">
              <button data-task-id="${task.id}" class="btn-edit-task p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition" title="Edit Activity">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button data-task-id="${task.id}" class="btn-delete-task p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:hover:bg-rose-950/60 transition" title="Permanently Delete">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          ${linkButtonHtml}

        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind item buttons
    this.taskListContainer.querySelectorAll('.btn-toggle-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-task-id');
        this.handleToggleTask(id);
      });
    });

    this.taskListContainer.querySelectorAll('.btn-edit-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-task-id');
        this.handleEditTask(id);
      });
    });

    this.taskListContainer.querySelectorAll('.btn-delete-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-task-id');
        this.handleDeleteTask(id);
      });
    });
  }

  resetTaskForm() {
    this.editingTaskId = null;
    this.taskEditId.value = '';
    this.taskTitle.value = '';
    this.taskDescription.value = '';
    this.taskTime.value = '';
    this.setTimePickerValue('');
    this.taskLinkUrl.value = '';
    this.taskLinkLabel.value = '';
    this.taskCategory.value = 'Work';

    // Reset priority radio to medium
    const mediumRadio = document.querySelector('input[name="priority"][value="medium"]');
    if (mediumRadio) {
      mediumRadio.checked = true;
      document.querySelectorAll('.priority-opt').forEach(opt => opt.classList.remove('selected-priority'));
      mediumRadio.closest('.priority-opt')?.classList.add('selected-priority');
    }

    const saveBtn = document.getElementById('btnSaveTask');
    if (saveBtn) {
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Save Activity</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  handleEditTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    this.editingTaskId = task.id;
    this.taskEditId.value = task.id;
    this.taskTitle.value = task.title || '';
    this.taskDescription.value = task.description || '';
    this.taskTime.value = task.time || '';
    this.setTimePickerValue(task.time || '');
    this.taskCategory.value = task.category || 'Work';
    this.taskLinkUrl.value = task.linkUrl || '';
    this.taskLinkLabel.value = task.linkLabel || '';

    const priorityRadio = document.querySelector(`input[name="priority"][value="${task.priority || 'medium'}"]`);
    if (priorityRadio) {
      priorityRadio.checked = true;
      document.querySelectorAll('.priority-opt').forEach(opt => opt.classList.remove('selected-priority'));
      priorityRadio.closest('.priority-opt')?.classList.add('selected-priority');
    }

    const saveBtn = document.getElementById('btnSaveTask');
    if (saveBtn) {
      saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Update Activity</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    this.switchTrackerTab('add');
  }

  async handleSaveTask(e) {
    e.preventDefault();

    const title = this.taskTitle.value.trim();
    if (!title) {
      this.showToast('Please enter an activity title', 'warning');
      return;
    }

    const priorityInput = document.querySelector('input[name="priority"]:checked');
    const priority = priorityInput ? priorityInput.value : 'medium';

    const taskPayload = {
      title,
      description: this.taskDescription.value.trim(),
      date: this.taskTargetDate.value || this.selectedDate,
      time: this.taskTime.value,
      category: this.taskCategory.value,
      linkUrl: this.taskLinkUrl.value.trim(),
      linkLabel: this.taskLinkLabel.value.trim(),
      priority
    };

    try {
      if (this.editingTaskId) {
        await API.updateTask(this.editingTaskId, taskPayload);
        this.showToast('Activity updated in JSON database', 'success');
      } else {
        await API.createTask(taskPayload);
        this.showToast('New activity saved with bookmark ribbon!', 'success');
      }

      await this.loadTasks();
      
      // Update modal view (only active / incomplete tasks)
      const dayTasks = this.tasks.filter(t => t.date === this.selectedDate && !t.completed);
      this.tabTaskCount.textContent = dayTasks.length;
      this.renderDayTaskList(dayTasks);
      this.resetTaskForm();
      this.switchTrackerTab('view');

    } catch (err) {
      this.showToast('Failed to save activity to JSON', 'error');
    }
  }

  async handleToggleTask(id) {
    try {
      const res = await API.toggleTask(id);
      const isComp = res.task.completed;
      this.showToast(isComp ? 'Activity marked as done! Moved to Completed.' : 'Activity restored to calendar', 'success');
      await this.loadTasks();
      
      const dayTasks = this.tasks.filter(t => t.date === this.selectedDate && !t.completed);
      this.tabTaskCount.textContent = dayTasks.length;
      this.renderDayTaskList(dayTasks);
    } catch (err) {
      this.showToast('Failed to update task state', 'error');
    }
  }

  async handleDeleteTask(id) {
    const confirmed = await this.showConfirmDialog({
      title: 'Permanently Delete Activity?',
      message: 'This activity will be permanently removed from your JSON primary storage database. This action cannot be undone.',
      confirmText: 'Delete Permanently',
      cancelText: 'Keep Activity',
      type: 'danger',
      icon: 'trash-2'
    });

    if (!confirmed) return;

    try {
      await API.deleteTask(id);
      this.showToast('Activity permanently deleted from JSON', 'info');
      await this.loadTasks();

      const dayTasks = this.tasks.filter(t => t.date === this.selectedDate && !t.completed);
      this.tabTaskCount.textContent = dayTasks.length;
      this.renderDayTaskList(dayTasks);

      if (dayTasks.length === 0) {
        this.switchTrackerTab('add');
      }
    } catch (err) {
      this.showToast('Failed to delete activity from JSON', 'error');
    }
  }

  // ==========================================================
  // COMPLETED TASKS OVERVIEW, CLEANUP & PDF GENERATOR
  // ==========================================================

  openCompletedModal() {
    document.body.classList.add('modal-open');
    if (window.weatherEngine) window.weatherEngine.pause();

    this.renderCompletedTasksList();
    this.completedModal.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.completedModal.classList.remove('opacity-0');
    });
  }

  closeCompletedModal() {
    this.completedModal.classList.add('opacity-0');
    setTimeout(() => {
      this.completedModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      if (window.weatherEngine) window.weatherEngine.resume();
    }, 120);
  }

  renderCompletedTasksList() {
    if (!this.completedListContainer) return;

    const filterVal = this.completedYearFilter.value;
    let completedList = this.tasks.filter(t => t.completed);

    if (filterVal !== 'all') {
      completedList = completedList.filter(t => t.date && t.date.startsWith(filterVal));
    }

    if (completedList.length === 0) {
      this.completedListContainer.innerHTML = `
        <div class="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <i data-lucide="award" class="w-10 h-10 mx-auto opacity-40"></i>
          <p class="text-sm font-semibold">No completed activities found for the selected period.</p>
          <p class="text-xs">Mark booked tasks as completed on the calendar to see them here.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    this.completedListContainer.innerHTML = completedList.map(task => {
      let linkButtonHtml = '';
      if (task.linkUrl) {
        const displayLabel = task.linkLabel && task.linkLabel.trim() ? task.linkLabel.trim() : 'Document Link';
        linkButtonHtml = `
          <a href="${task.linkUrl}" target="_blank" rel="noopener noreferrer" class="custom-link-pill text-[10px]">
            <i data-lucide="external-link" class="w-3 h-3"></i>
            <span>${this.escapeHtml(displayLabel)}</span>
          </a>
        `;
      }

      return `
        <div class="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <i data-lucide="check" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="font-bold text-sm text-slate-900 dark:text-white">${this.escapeHtml(task.title)}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Date: <strong>${task.date}</strong></span>
                ${task.time ? `<span>• Time: ${task.time}</span>` : ''}
                <span>• Category: ${task.category || 'General'}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${linkButtonHtml}
            <button data-task-id="${task.id}" class="btn-undo-complete p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition" title="Mark back as Incomplete">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
            </button>
            <button data-task-id="${task.id}" class="btn-delete-completed p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition" title="Delete from JSON">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    this.completedListContainer.querySelectorAll('.btn-undo-complete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-task-id');
        await this.handleToggleTask(id);
        this.renderCompletedTasksList();
      });
    });

    this.completedListContainer.querySelectorAll('.btn-delete-completed').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-task-id');
        await this.handleDeleteTask(id);
        this.renderCompletedTasksList();
      });
    });
  }

  // Clean up completed tasks from JSON database to free up disk storage
  async handleCleanUpCompleted() {
    const filterYear = this.completedYearFilter.value;
    const yearMsg = filterYear === 'all' ? 'all recorded years' : `the year ${filterYear}`;
    
    const confirmed = await this.showConfirmDialog({
      title: 'Clean Up Completed Tasks?',
      message: `Permanently purge all completed tasks for ${yearMsg} from the JSON primary database?\n\nThis will free up disk storage immediately. This action cannot be undone.`,
      confirmText: 'Purge & Free Space',
      cancelText: 'Keep Records',
      type: 'danger',
      icon: 'trash-2'
    });

    if (!confirmed) return;

    try {
      const yearParam = filterYear === 'all' ? null : filterYear;
      const res = await API.cleanupCompleted(yearParam);
      this.showToast(`Cleaned up ${res.removedCount} completed task(s) to free up space!`, 'success');
      await this.loadTasks();
      this.renderCompletedTasksList();
    } catch (err) {
      this.showToast('Failed to clean up tasks from JSON', 'error');
    }
  }

  // Generate downloadable PDF Review Report
  generatePdfReview() {
    const reportArea = document.getElementById('completedPrintableArea');
    const reportHeader = document.getElementById('completedListHeader');
    const reportSubtext = document.getElementById('pdfReportSubtext');

    if (!reportArea) return;

    const filterVal = this.completedYearFilter.value;
    const yearLabel = filterVal === 'all' ? 'All-Time' : `Year ${filterVal}`;
    if (reportSubtext) {
      reportSubtext.textContent = `Annual Activity Review for ${yearLabel} • Weather Base: Malaybalay City • Storage: JSON`;
    }

    // Reveal printable report header
    if (reportHeader) reportHeader.classList.remove('hidden');

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `trame_completed_tasks_review_${filterVal}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    this.showToast('Generating PDF Review Report...', 'info');

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(reportArea).save().then(() => {
        if (reportHeader) reportHeader.classList.add('hidden');
        this.showToast('PDF Review Report downloaded successfully!', 'success');
      }).catch(err => {
        console.error('PDF error:', err);
        if (reportHeader) reportHeader.classList.add('hidden');
        window.print();
      });
    } else {
      window.print();
      if (reportHeader) reportHeader.classList.add('hidden');
    }
  }

  // ==========================================================
  // CUSTOM MODERN TIME PICKER (Dark Mode, Rounded, Zero Native Glitches)
  // ==========================================================
  initCustomTimePicker() {
    this.tpState = { hour: 5, minute: 30, period: 'PM' };
    
    const btnOpen = document.getElementById('btnOpenTimePicker');
    const dropdown = document.getElementById('customTimePickerDropdown');
    const btnClear = document.getElementById('btnClearTime');
    const btnDismiss = document.getElementById('btnDismissTimePicker');
    const btnDone = document.getElementById('btnDoneTimePicker');
    const hourUp = document.getElementById('btnHourUp');
    const hourDown = document.getElementById('btnHourDown');
    const minUp = document.getElementById('btnMinuteUp');
    const minDown = document.getElementById('btnMinuteDown');
    const btnAM = document.getElementById('timePeriodAM');
    const btnPM = document.getElementById('timePeriodPM');

    if (!btnOpen || !dropdown) return;

    const updateDisplay = () => {
      const hourEl = document.getElementById('timeHourDisplay');
      const minEl = document.getElementById('timeMinuteDisplay');
      if (hourEl) hourEl.textContent = String(this.tpState.hour).padStart(2, '0');
      if (minEl) minEl.textContent = String(this.tpState.minute).padStart(2, '0');

      if (btnAM && btnPM) {
        if (this.tpState.period === 'AM') {
          btnAM.className = 'px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold transition';
          btnPM.className = 'px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 font-bold transition';
        } else {
          btnPM.className = 'px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold transition';
          btnAM.className = 'px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 font-bold transition';
        }
      }
    };

    btnOpen.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      updateDisplay();
    });

    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => {
        dropdown.classList.add('hidden');
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setTimePickerValue('');
      });
    }

    if (hourUp) {
      hourUp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tpState.hour = this.tpState.hour >= 12 ? 1 : this.tpState.hour + 1;
        updateDisplay();
      });
    }

    if (hourDown) {
      hourDown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tpState.hour = this.tpState.hour <= 1 ? 12 : this.tpState.hour - 1;
        updateDisplay();
      });
    }

    if (minUp) {
      minUp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tpState.minute = (this.tpState.minute + 5) % 60;
        updateDisplay();
      });
    }

    if (minDown) {
      minDown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tpState.minute = (this.tpState.minute - 5 + 60) % 60;
        updateDisplay();
      });
    }

    if (btnAM) {
      btnAM.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tpState.period = 'AM';
        updateDisplay();
      });
    }

    if (btnPM) {
      btnPM.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tpState.period = 'PM';
        updateDisplay();
      });
    }

    // Presets
    document.querySelectorAll('.time-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const preset = e.currentTarget.getAttribute('data-preset-time');
        if (preset) {
          const parts = preset.split(' ');
          const [h, m] = parts[0].split(':').map(Number);
          this.tpState.hour = h;
          this.tpState.minute = m;
          this.tpState.period = parts[1] || 'PM';
          updateDisplay();
        }
      });
    });

    if (btnDone) {
      btnDone.addEventListener('click', (e) => {
        e.stopPropagation();
        const formatted = `${String(this.tpState.hour).padStart(2, '0')}:${String(this.tpState.minute).padStart(2, '0')} ${this.tpState.period}`;
        this.applySelectedTime(formatted);
        dropdown.classList.add('hidden');
      });
    }

    // Dismiss on click outside
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('customTimePickerWrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  applySelectedTime(formattedStr) {
    const input = document.getElementById('taskTime');
    const textEl = document.getElementById('timePickerDisplayText');
    const clearBtn = document.getElementById('btnClearTime');

    if (input) input.value = formattedStr;
    if (textEl) {
      textEl.textContent = formattedStr;
      textEl.className = 'font-bold text-slate-900 dark:text-white text-xs sm:text-sm';
    }
    if (clearBtn) clearBtn.classList.remove('hidden');
  }

  setTimePickerValue(timeStr) {
    const input = document.getElementById('taskTime');
    const textEl = document.getElementById('timePickerDisplayText');
    const clearBtn = document.getElementById('btnClearTime');

    if (!timeStr || !timeStr.trim()) {
      if (input) input.value = '';
      if (textEl) {
        textEl.textContent = 'Set deadline time...';
        textEl.className = 'text-slate-400 dark:text-slate-500 text-xs';
      }
      if (clearBtn) clearBtn.classList.add('hidden');
      if (this.tpState) this.tpState = { hour: 5, minute: 30, period: 'PM' };
      return;
    }

    let raw = timeStr.trim();
    let hour = 12, min = 0, period = 'PM';

    if (raw.includes('AM') || raw.includes('PM')) {
      const parts = raw.split(' ');
      const [h, m] = parts[0].split(':').map(Number);
      hour = h;
      min = m;
      period = parts[1];
    } else if (raw.includes(':')) {
      const [h, m] = raw.split(':').map(Number);
      period = h >= 12 ? 'PM' : 'AM';
      hour = h % 12 || 12;
      min = m;
    }

    if (this.tpState) {
      this.tpState.hour = hour;
      this.tpState.minute = min;
      this.tpState.period = period;
    }

    const formatted = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
    this.applySelectedTime(formatted);
  }

  // Modern Custom Confirmation Dialog / Toast Pop-up (Replaces native browser confirm)
  showConfirmDialog({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Yes, Proceed',
    cancelText = 'Cancel',
    type = 'danger',
    icon = 'trash-2'
  } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('customConfirmModal');
      const card = document.getElementById('customConfirmCard');
      const titleEl = document.getElementById('confirmTitle');
      const messageEl = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('btnConfirmOk');
      const cancelBtn = document.getElementById('btnConfirmCancel');
      const okTextEl = document.getElementById('confirmOkText');
      const iconContainer = document.getElementById('confirmIconContainer');
      const iconSlot = document.getElementById('confirmOkIconSlot');

      if (!modal || !card) {
        resolve(true);
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      okTextEl.textContent = confirmText;
      cancelBtn.textContent = cancelText;

      // Modern color accents
      if (type === 'danger') {
        iconContainer.className = 'w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-inner';
        iconContainer.innerHTML = `<i data-lucide="${icon || 'trash-2'}" class="w-6 h-6"></i>`;
        okBtn.className = 'px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition flex items-center gap-1.5';
        if (iconSlot) iconSlot.innerHTML = `<i data-lucide="${icon || 'trash-2'}" class="w-3.5 h-3.5"></i>`;
      } else {
        iconContainer.className = 'w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-inner';
        iconContainer.innerHTML = `<i data-lucide="${icon || 'help-circle'}" class="w-6 h-6"></i>`;
        okBtn.className = 'px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/30 transition flex items-center gap-1.5';
        if (iconSlot) iconSlot.innerHTML = `<i data-lucide="${icon || 'check'}" class="w-3.5 h-3.5"></i>`;
      }

      if (window.lucide) window.lucide.createIcons();

      // Lock body scroll and pause canvas
      document.body.classList.add('modal-open');
      if (window.weatherEngine) window.weatherEngine.pause();

      // Animate In instantaneously
      modal.classList.remove('hidden');
      requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-95');
      });

      const cleanup = (confirmed) => {
        card.classList.add('scale-95');
        modal.classList.add('opacity-0');
        setTimeout(() => {
          modal.classList.add('hidden');
          okBtn.removeEventListener('click', onOk);
          cancelBtn.removeEventListener('click', onCancel);
          modal.removeEventListener('click', onBackdrop);
          window.removeEventListener('keydown', onKeyDown);

          // Restore scroll if no other modals are open
          const trackerOpen = document.getElementById('trackerModal') && !document.getElementById('trackerModal').classList.contains('hidden');
          const completedOpen = document.getElementById('completedModal') && !document.getElementById('completedModal').classList.contains('hidden');
          if (!trackerOpen && !completedOpen) {
            document.body.classList.remove('modal-open');
            if (window.weatherEngine) window.weatherEngine.resume();
          }

          resolve(confirmed);
        }, 120);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => {
        if (e.target === modal) cleanup(false);
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(false);
        if (e.key === 'Enter') cleanup(true);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      window.addEventListener('keydown', onKeyDown);
    });
  }

  // Toast Notification System
  showToast(message, type = 'info') {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    if (!toast) return;

    const icons = {
      success: '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-400"></i>',
      error: '<i data-lucide="alert-triangle" class="w-5 h-5 text-rose-400"></i>',
      warning: '<i data-lucide="alert-circle" class="w-5 h-5 text-amber-400"></i>',
      info: '<i data-lucide="info" class="w-5 h-5 text-sky-400"></i>'
    };

    toastIcon.innerHTML = icons[type] || icons.info;
    toastMsg.textContent = message;
    if (window.lucide) window.lucide.createIcons();

    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  // Event Listeners Binding
  bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('btnThemeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Year navigation
    const btnPrevYear = document.getElementById('btnPrevYear');
    const btnNextYear = document.getElementById('btnNextYear');
    const btnJumpToday = document.getElementById('btnJumpToday');

    if (btnPrevYear) {
      btnPrevYear.addEventListener('click', async () => {
        this.currentYear--;
        await this.loadTasks();
      });
    }

    if (btnNextYear) {
      btnNextYear.addEventListener('click', async () => {
        this.currentYear++;
        await this.loadTasks();
      });
    }

    if (btnJumpToday) {
      btnJumpToday.addEventListener('click', async () => {
        const todayDate = new Date();
        this.currentYear = todayDate.getFullYear();
        await this.loadTasks();

        // Scroll to today's month
        const targetMonthId = `month-card-${todayDate.getMonth()}`;
        const targetEl = document.getElementById(targetMonthId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    // Tracker Modal Tabs
    if (this.tabBtnViewTasks) {
      this.tabBtnViewTasks.addEventListener('click', () => this.switchTrackerTab('view'));
    }
    if (this.tabBtnAddTask) {
      this.tabBtnAddTask.addEventListener('click', () => {
        this.resetTaskForm();
        this.switchTrackerTab('add');
      });
    }
    const btnSwitchToAddTask = document.getElementById('btnSwitchToAddTask');
    if (btnSwitchToAddTask) {
      btnSwitchToAddTask.addEventListener('click', () => {
        this.resetTaskForm();
        this.switchTrackerTab('add');
      });
    }

    // Tracker Modal Form Submit & Cancel
    if (this.trackerForm) {
      this.trackerForm.addEventListener('submit', (e) => this.handleSaveTask(e));
    }
    const btnCancelTaskForm = document.getElementById('btnCancelTaskForm');
    if (btnCancelTaskForm) {
      btnCancelTaskForm.addEventListener('click', () => this.switchTrackerTab('view'));
    }
    const btnCloseTracker = document.getElementById('btnCloseTrackerModal');
    if (btnCloseTracker) {
      btnCloseTracker.addEventListener('click', () => this.closeTrackerModal());
    }
    this.trackerModal.addEventListener('click', (e) => {
      if (e.target === this.trackerModal) this.closeTrackerModal();
    });

    // Completed Tasks Modal
    const btnOpenCompleted = document.getElementById('btnOpenCompleted');
    if (btnOpenCompleted) {
      btnOpenCompleted.addEventListener('click', () => this.openCompletedModal());
    }
    const btnCloseCompleted = document.getElementById('btnCloseCompletedModal');
    if (btnCloseCompleted) {
      btnCloseCompleted.addEventListener('click', () => this.closeCompletedModal());
    }
    this.completedModal.addEventListener('click', (e) => {
      if (e.target === this.completedModal) this.closeCompletedModal();
    });

    if (this.completedYearFilter) {
      this.completedYearFilter.addEventListener('change', () => this.renderCompletedTasksList());
    }

    // Clean up & PDF Export
    const btnCleanUp = document.getElementById('btnCleanUpCompleted');
    if (btnCleanUp) {
      btnCleanUp.addEventListener('click', () => this.handleCleanUpCompleted());
    }

    const btnPdf = document.getElementById('btnGeneratePdf');
    if (btnPdf) {
      btnPdf.addEventListener('click', () => this.generatePdfReview());
    }

    // Instant priority radio selection with zero delay
    document.querySelectorAll('input[name="priority"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        document.querySelectorAll('.priority-opt').forEach(opt => opt.classList.remove('selected-priority'));
        e.target.closest('.priority-opt')?.classList.add('selected-priority');
      });
    });

    // Floating Scroll To Top Button (Bottom-Right Circle)
    const btnScrollTop = document.getElementById('btnScrollToTop');
    if (btnScrollTop) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 250) {
          btnScrollTop.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
          btnScrollTop.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
        } else {
          btnScrollTop.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
          btnScrollTop.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }
      }, { passive: true });

      btnScrollTop.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }

    // Esc key close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTrackerModal();
        this.closeCompletedModal();
      }
    });
  }
}

// Instantiate on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  window.trameApp = new TrameApp();
});

