const countdownNumberEl = document.getElementById('countdown-number');
const start = document.getElementById("start");
const restart = document.getElementById("restart");
const pomoType = document.getElementById("pomo-type");
const skip = document.getElementById("skip");
const countDisplay = document.getElementById("count");

// Timer state constants
const TIMER_STATES = {
  POMO: 1,
  SBREAK: 2,
  LBREAK: 3,
  FINISHED: 4,
};

// Define an event listener registry for cleanup
const eventListenerRegistry = new Map();

// Load settings function - reuse settings from localStorage or get defaults
function loadSettings() {
  try {
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : {
      "Pomo Duration": "25",
      "Short Break Duration": "5",
      "Long Break Duration": "15",
      "Long Break Interval": "2",
      "Number Of Pomos": "4"
    };
  } catch (error) {
    console.error("Error loading settings:", error);
    return {
      "Pomo Duration": "25",
      "Short Break Duration": "5",
      "Long Break Duration": "15",
      "Long Break Interval": "2",
      "Number Of Pomos": "4"
    };
  }
}

// Get settings, with option to refresh from localStorage
let settings = loadSettings();

// Create a debounced settings reload function to prevent excessive recalculations
let settingsReloadTimeout;
function debouncedSettingsReload() {
  if (settingsReloadTimeout) {
    clearTimeout(settingsReloadTimeout);
  }
  settingsReloadTimeout = setTimeout(() => {
    // Only reload settings if we're not in the middle of a timer
    if (!started) {
      settings = loadSettings();
      updateTimerConstants();
      resetUI();
    }
  }, 300);
}

// Add event listener to window storage event to detect settings changes
window.addEventListener('storage', (event) => {
  if (event.key === 'settings') {
    debouncedSettingsReload();
  }
});

// Update timer constants from settings
function updateTimerConstants() {
  POMO_DURATION = minToSec(parseInt(settings["Pomo Duration"]));
  SHORT_BREAK = minToSec(parseInt(settings["Short Break Duration"]));
  LONG_BREAK = minToSec(parseInt(settings["Long Break Duration"]));
  LONG_BREAK_INTERVAL = parseInt(settings["Long Break Interval"]);
  REPETITION = parseInt(settings["Number Of Pomos"]);
  
  // Update animations with new durations
  updateAnimations();
}

// Convert settings to variables for easier use
let POMO_DURATION = minToSec(parseInt(settings["Pomo Duration"]));
let SHORT_BREAK = minToSec(parseInt(settings["Short Break Duration"]));
let LONG_BREAK = minToSec(parseInt(settings["Long Break Duration"]));
let LONG_BREAK_INTERVAL = parseInt(settings["Long Break Interval"]);
let REPETITION = parseInt(settings["Number Of Pomos"]);

// Timer state variables
let count = 1;
let currentTimerID = null;
let timeLeft = POMO_DURATION;
let started = false;
let state = TIMER_STATES.POMO;
let completedPomos = 0;
let sessionStartTime = null;
let lastNotificationTime = 0; // Prevent notification spam

// Audio notifications - lazy load when needed
const audioNotifications = {
  _pomodoro: null,
  _break: null,
  _complete: null,
  _tick: null,
  
  get pomodoro() {
    if (!this._pomodoro) {
      this._pomodoro = new Audio('https://soundbible.com/mp3/service-bell_daniel_simion.mp3');
      this._pomodoro.preload = 'none'; // Don't preload until needed
    }
    return this._pomodoro;
  },
  
  get break() {
    if (!this._break) {
      this._break = new Audio('https://soundbible.com/mp3/analog-watch-alarm_daniel-simion.mp3');
      this._break.preload = 'none';
    }
    return this._break;
  },
  
  get complete() {
    if (!this._complete) {
      this._complete = new Audio('https://soundbible.com/mp3/fairy-meeting_daniel-simion.mp3');
      this._complete.preload = 'none';
    }
    return this._complete;
  },
  
  get tick() {
    if (!this._tick) {
      this._tick = new Audio('https://soundbible.com/mp3/analog-watch-alarm_daniel-simion.mp3');
      this._tick.preload = 'none';
      this._tick.volume = 0.3; // Lower volume for tick sounds
    }
    return this._tick;
  }
};

// Check if notifications are enabled (default to true)
let notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';

// Create animations but don't start them yet
let currentAnimation = null;
let animations = {
  pomo: null,
  shortBreak: null,
  longBreak: null
};

// Initialize animations
function updateAnimations() {
  animations = {
    pomo: createAnimation(POMO_DURATION),
    shortBreak: createAnimation(SHORT_BREAK),
    longBreak: createAnimation(LONG_BREAK)
  };
}

// Call initial update
updateAnimations();

// Initialize UI
function resetUI() {
  restart.disabled = true;
  countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION);
  pomoType.innerHTML = "Time to focus";
  countDisplay.innerHTML = `${count} out of ${REPETITION}`;
}

// Initial UI setup
resetUI();

// Add notification toggle UI (append to the timer controls section)
function setupNotificationToggle() {
  const existingToggle = document.getElementById('notifications-toggle');
  if (existingToggle) return; // Already added
  
  document.querySelector('.controls').insertAdjacentHTML('afterend', 
    `<div class="notifications-toggle">
      <label>
        <input type="checkbox" id="notifications-toggle" ${notificationsEnabled ? 'checked' : ''}>
        Sound notifications
      </label>
    </div>`
  );

  // Register event listener with our registry for potential future cleanup
  const notifToggle = document.getElementById('notifications-toggle');
  const notifChangeHandler = function(e) {
    notificationsEnabled = e.target.checked;
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
  };
  
  notifToggle.addEventListener('change', notifChangeHandler);
  eventListenerRegistry.set(notifToggle, {
    event: 'change',
    handler: notifChangeHandler
  });
}

setupNotificationToggle();

/**
 * Start button click handler - Manages all timer states
 */
start.onclick = () => {
  restart.disabled = false;
  
  if (started) {
    pauseTimer();
    return;
  }
  
  // Record session start time if this is the first pomodoro
  if (state === TIMER_STATES.POMO && count === 1 && !sessionStartTime) {
    sessionStartTime = new Date();
  }
  
  switch (state) {
    case TIMER_STATES.POMO:
      startTimer(timeLeft, "Time to focus", animations.pomo);
      break;
    case TIMER_STATES.SBREAK:
      startTimer(timeLeft, "Relax a little", animations.shortBreak);
      break;
    case TIMER_STATES.LBREAK:
      startTimer(timeLeft, "What about a fresh breeze?", animations.longBreak);
      break;
    case TIMER_STATES.FINISHED:
      resetEverything();
      startTimer(POMO_DURATION, "Time to focus", animations.pomo);
      break;
  }
};

/**
 * Restart button click handler
 */
restart.onclick = () => {
  restart.disabled = true;
  clearTimer();
  
  switch (state) {
    case TIMER_STATES.POMO:
      timeLeft = POMO_DURATION;
      startTimer(timeLeft, "Time to focus", animations.pomo);
      break;
    case TIMER_STATES.SBREAK:
      timeLeft = SHORT_BREAK;
      startTimer(timeLeft, "Relax a little", animations.shortBreak);
      break;
    case TIMER_STATES.LBREAK:
      timeLeft = LONG_BREAK;
      startTimer(timeLeft, "What about a fresh breeze?", animations.longBreak);
      break;
  }
};

/**
 * Skip button click handler
 */
skip.onclick = () => {
  clearTimer();
  
  switch (state) {
    case TIMER_STATES.POMO:
      handlePomoSkip();
      break;
    case TIMER_STATES.SBREAK:
    case TIMER_STATES.LBREAK:
      handleBreakSkip();
      break;
  }
};

/**
 * Optimized timer with requestAnimationFrame for better accuracy
 * Replaces setInterval which can drift and is less efficient
 * @param {number} duration - Duration in seconds
 * @param {string} message - Message to display
 * @param {object} animation - Animation to play
 */
function startTimer(duration, message, animation) {
  timeLeft = duration;
  pomoType.innerHTML = message;
  countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
  
  // Performance optimization: reset animation if it exists
  if (currentAnimation) {
    currentAnimation.restart();
  }
  
  currentAnimation = animation;
  currentAnimation.play();
  
  let lastTimestamp = Date.now();
  let accumulatedTime = 0;
  
  const timerLoop = () => {
    if (!started) return; // Exit if timer is paused
    
    const now = Date.now();
    const deltaTime = now - lastTimestamp;
    lastTimestamp = now;
    
    accumulatedTime += deltaTime;
    
    // Only update once per second to avoid excessive DOM updates
    if (accumulatedTime >= 1000) {
      const secondsToRemove = Math.floor(accumulatedTime / 1000);
      timeLeft -= secondsToRemove;
      accumulatedTime -= secondsToRemove * 1000;
      
      countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
      
      // Play a tick sound at 5, 4, 3, 2, 1 seconds remaining with throttling
      if (timeLeft <= 5 && timeLeft >= 1 && notificationsEnabled && now - lastNotificationTime > 900) {
        lastNotificationTime = now;
        audioNotifications.tick.currentTime = 0;
        audioNotifications.tick.play().catch(e => console.log('Sound play prevented:', e));
      }
      
      if (timeLeft < 1) {
        clearTimer();
        
        if (state === TIMER_STATES.POMO) {
          if (notificationsEnabled) {
            audioNotifications.pomodoro.play().catch(e => console.log('Sound play prevented:', e));
          }
          handlePomoComplete();
        } else if (state === TIMER_STATES.SBREAK || state === TIMER_STATES.LBREAK) {
          if (notificationsEnabled) {
            audioNotifications.break.play().catch(e => console.log('Sound play prevented:', e));
          }
          handleBreakComplete();
        }
        return;
      }
    }
    
    // Use requestAnimationFrame for smoother timer
    currentTimerID = requestAnimationFrame(timerLoop);
  };
  
  // Start the timer loop
  started = true;
  lastTimestamp = Date.now();
  currentTimerID = requestAnimationFrame(timerLoop);
  
  // Update button appearance
  start.textContent = "Pause";
  start.style.backgroundColor = "#D92828";
}

/**
 * Pauses the current timer
 */
function pauseTimer() {
  start.textContent = "Resume";
  start.style.backgroundColor = "#2ecc71";
  
  if (currentAnimation) {
    currentAnimation.pause();
  }
  
  started = false;
}

/**
 * Clears the current timer and resets UI
 */
function clearTimer() {
  if (currentTimerID) {
    cancelAnimationFrame(currentTimerID);
    currentTimerID = null;
  }
  
  if (currentAnimation) {
    currentAnimation.restart();
    currentAnimation.pause();
  }
  
  started = false;
  start.textContent = "Start";
  start.style.backgroundColor = "#2ecc71";
}

/**
 * Handles what happens when a Pomodoro timer completes
 */
function handlePomoComplete() {
  completedPomos++;
  
  // Show browser notification if supported and permitted
  if ("Notification" in window && Notification.permission === "granted") {
    // Use setTimeout to prevent notification blocking
    setTimeout(() => {
      new Notification("Pomodoro Complete!", {
        body: "Time for a break!",
        icon: "./assets/Logo.png"
      });
    }, 0);
  }
  
  if (count < REPETITION) {
    if (count % LONG_BREAK_INTERVAL === 0) {
      state = TIMER_STATES.LBREAK;
      timeLeft = LONG_BREAK;
      pomoType.innerHTML = "What about a fresh breeze?";
      countdownNumberEl.innerHTML = secondsToMinutes(LONG_BREAK);
    } else {
      state = TIMER_STATES.SBREAK;
      timeLeft = SHORT_BREAK;
      pomoType.innerHTML = "Relax a little";
      countdownNumberEl.innerHTML = secondsToMinutes(SHORT_BREAK);
    }
  } else {
    completeAllPomodoros();
  }
  
  // Save progress to localStorage for recovery in case of page refresh
  saveProgress();
}

/**
 * Handles what happens when a break timer completes
 */
function handleBreakComplete() {
  if (count < REPETITION) {
    count++;
    countDisplay.innerHTML = `${count} out of ${REPETITION}`;
    state = TIMER_STATES.POMO;
    timeLeft = POMO_DURATION;
    pomoType.innerHTML = "Time to focus";
    countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION);
  } else {
    completeAllPomodoros();
  }
  
  // Save progress
  saveProgress();
}

/**
 * Handles skipping a Pomodoro timer
 */
function handlePomoSkip() {
  if (count < REPETITION) {
    if (count % LONG_BREAK_INTERVAL === 0) {
      state = TIMER_STATES.LBREAK;
      timeLeft = LONG_BREAK;
      pomoType.innerHTML = "What about a fresh breeze?";
      countdownNumberEl.innerHTML = secondsToMinutes(LONG_BREAK);
    } else {
      state = TIMER_STATES.SBREAK;
      timeLeft = SHORT_BREAK;
      pomoType.innerHTML = "Relax a little";
      countdownNumberEl.innerHTML = secondsToMinutes(SHORT_BREAK);
    }
  } else {
    completeAllPomodoros();
  }
  
  // Save progress
  saveProgress();
}

/**
 * Handles skipping a break timer
 */
function handleBreakSkip() {
  if (count < REPETITION) {
    count++;
    countDisplay.innerHTML = `${count} out of ${REPETITION}`;
    state = TIMER_STATES.POMO;
    timeLeft = POMO_DURATION;
    pomoType.innerHTML = "Time to focus";
    countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION);
  } else {
    completeAllPomodoros();
  }
  
  // Save progress
  saveProgress();
}

/**
 * Sets the timer to the finished state and saves session data
 */
function completeAllPomodoros() {
  skip.disabled = true;
  state = TIMER_STATES.FINISHED;
  countdownNumberEl.innerHTML = "00:00";
  pomoType.innerHTML = "Looks like you finished all your pomodoros, well done champ!";
  
  if (notificationsEnabled) {
    audioNotifications.complete.play().catch(e => console.log('Sound play prevented:', e));
  }
  
  // Calculate session duration only if we have a valid start time
  if (sessionStartTime) {
    const sessionEndTime = new Date();
    const sessionDuration = Math.floor((sessionEndTime - sessionStartTime) / 60000); // in minutes
    
    // Save session data to Firebase if user is logged in
    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        const db = firebase.database();
        const sessionData = {
          date: sessionEndTime.toISOString(),
          duration: sessionDuration,
          completedPomos: completedPomos,
          pomoDuration: settings["Pomo Duration"],
          totalPomos: REPETITION
        };
        
        // Batch updates for better performance
        const updates = {};
        
        // Generate a unique key for this session
        const newSessionKey = db.ref('users/' + user.uid + '/sessions').push().key;
        updates['users/' + user.uid + '/sessions/' + newSessionKey] = sessionData;
        
        // Update user stats in the same transaction
        db.ref('users/' + user.uid + '/stats').once('value')
          .then((snapshot) => {
            const currentStats = snapshot.val() || {
              totalSessions: 0,
              totalPomos: 0,
              totalMinutes: 0
            };
            
            updates['users/' + user.uid + '/stats'] = {
              totalSessions: currentStats.totalSessions + 1,
              totalPomos: currentStats.totalPomos + completedPomos,
              totalMinutes: currentStats.totalMinutes + sessionDuration
            };
            
            // Apply all updates in a single transaction
            return db.ref().update(updates);
          })
          .then(() => {
            console.log("Session saved successfully");
          })
          .catch(error => {
            console.error("Error saving session:", error);
          });
      }
    });
  }
  
  // Clear progress since we're done
  clearProgress();
  
  // Show celebration
  showCelebration();
}

/**
 * Shows a celebration animation when all pomodoros are completed
 */
function showCelebration() {
  const celebrationEl = document.createElement('div');
  celebrationEl.className = 'celebration';
  celebrationEl.innerHTML = `
    <div class="celebration-content">
      <h2>Congratulations!</h2>
      <p>You've completed all your pomodoros!</p>
      <p>Total completed: ${completedPomos}</p>
      <button id="start-new-session">Start New Session</button>
    </div>
  `;
  document.body.appendChild(celebrationEl);
  
  // Add event listener to the new session button
  const newSessionBtn = document.getElementById('start-new-session');
  const handleNewSession = () => {
    document.body.removeChild(celebrationEl);
    resetEverything();
    // Reset the UI but don't start automatically
    countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION);
  };
  
  newSessionBtn.addEventListener('click', handleNewSession);
  
  // Remove celebration after 30 seconds if not clicked
  const timeoutId = setTimeout(() => {
    if (document.body.contains(celebrationEl)) {
      celebrationEl.classList.add('fade-out');
      setTimeout(() => {
        if (document.body.contains(celebrationEl)) {
          document.body.removeChild(celebrationEl);
        }
      }, 1000);
    }
  }, 30000);
  
  // Clean up event listener when removing celebration
  const originalRemoveChild = document.body.removeChild;
  document.body.removeChild = function(child) {
    if (child === celebrationEl) {
      clearTimeout(timeoutId);
      newSessionBtn.removeEventListener('click', handleNewSession);
      document.body.removeChild = originalRemoveChild;
    }
    return originalRemoveChild.call(this, child);
  };
}

/**
 * Resets everything to start a new session
 */
function resetEverything() {
  count = 1;
  completedPomos = 0;
  sessionStartTime = new Date();
  countDisplay.innerHTML = `${count} out of ${REPETITION}`;
  skip.disabled = false;
  state = TIMER_STATES.POMO;
  timeLeft = POMO_DURATION;
  clearProgress();
}

/**
 * Creates an animation for the timer ring with memory optimization
 * @param {number} duration - Duration in seconds
 * @returns {object} Animation object
 */
function createAnimation(duration) {
  return anime({
    targets: '#ring',
    strokeDashoffset: [0, anime.setDashoffset],
    easing: 'linear',
    duration: duration * 1000,
    autoplay: false
  });
}

/**
 * Save current progress to localStorage for recovery after page refresh
 */
function saveProgress() {
  const progress = {
    count,
    state,
    timeLeft,
    completedPomos,
    sessionStartTime: sessionStartTime ? sessionStartTime.toISOString() : null,
    lastUpdated: new Date().toISOString()
  };
  localStorage.setItem('timerProgress', JSON.stringify(progress));
}

/**
 * Clear saved progress data
 */
function clearProgress() {
  localStorage.removeItem('timerProgress');
}

/**
 * Recover saved progress if available and not too old
 */
function recoverProgress() {
  try {
    const savedProgress = localStorage.getItem('timerProgress');
    if (!savedProgress) return false;
    
    const progress = JSON.parse(savedProgress);
    const lastUpdated = new Date(progress.lastUpdated);
    const now = new Date();
    
    // Only recover if saved within the last 30 minutes
    if (now - lastUpdated > 30 * 60 * 1000) {
      clearProgress();
      return false;
    }
    
    // Recover state
    count = progress.count;
    state = progress.state;
    timeLeft = progress.timeLeft;
    completedPomos = progress.completedPomos;
    sessionStartTime = progress.sessionStartTime ? new Date(progress.sessionStartTime) : null;
    
    // Update UI based on recovered state
    countDisplay.innerHTML = `${count} out of ${REPETITION}`;
    
    switch (state) {
      case TIMER_STATES.POMO:
        pomoType.innerHTML = "Time to focus";
        break;
      case TIMER_STATES.SBREAK:
        pomoType.innerHTML = "Relax a little";
        break;
      case TIMER_STATES.LBREAK:
        pomoType.innerHTML = "What about a fresh breeze?";
        break;
    }
    
    countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
    return true;
    
  } catch (e) {
    console.error("Error recovering progress:", e);
    clearProgress();
    return false;
  }
}

/**
 * Converts minutes to seconds
 * @param {number} min - Minutes
 * @returns {number} Seconds
 */
function minToSec(min) {
  return min * 60;
}

/**
 * Converts seconds to MM:SS format
 * @param {number} s - Seconds
 * @returns {string} Formatted time string
 */
function secondsToMinutes(s) {
  if (s <= 0) return "00:00";
  
  if (s < 60) {
    s = s.toLocaleString('en-US', {
      minimumIntegerDigits: 2,
      useGrouping: false
    });
    return "00:" + s;
  } else {
    let m = Math.floor(s / 60).toLocaleString('en-US', {
      minimumIntegerDigits: 2,
      useGrouping: false
    });
    let seconds = (s % 60).toLocaleString('en-US', {
      minimumIntegerDigits: 2,
      useGrouping: false
    });
    return m + ":" + seconds;
  }
}

// Request notification permission when page loads 
if ("Notification" in window) {
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    // Ask for permission on first user interaction for better UX
    const requestNotificationPermission = () => {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
      // Remove the event listeners after first interaction
      document.removeEventListener('click', requestNotificationPermission);
      document.removeEventListener('keydown', requestNotificationPermission);
    };
    
    document.addEventListener('click', requestNotificationPermission, { once: true });
    document.addEventListener('keydown', requestNotificationPermission, { once: true });
  }
}

// Try to recover progress when page loads
window.addEventListener('DOMContentLoaded', () => {
  recoverProgress();
});

// Clean up resources when page unloads to prevent memory leaks
window.addEventListener('beforeunload', () => {
  // Clear animations
  if (currentAnimation) {
    currentAnimation.pause();
    currentAnimation = null;
  }
  
  // Save current progress
  if (state !== TIMER_STATES.FINISHED && started) {
    saveProgress();
  }
  
  // Clean up event listeners
  for (const [element, { event, handler }] of eventListenerRegistry.entries()) {
    if (element && element.removeEventListener) {
      element.removeEventListener(event, handler);
    }
  }
  eventListenerRegistry.clear();
});