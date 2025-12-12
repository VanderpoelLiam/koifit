/**
 * Session management and auto-save coordination
 */
import { AutoSave } from "./auto-save.js";

class RestTimer {
  static STORAGE_KEY = "koifit_rest_timer";

  constructor() {
    this.timerElement = document.getElementById("rest-timer");
    this.timeDisplay = document.getElementById("timer-time");
    this.skipButton = document.getElementById("timer-skip");
    this.intervalId = null;
    this.remainingSeconds = 0;
    this.totalSeconds = 0;
    this.endTime = null;

    if (this.skipButton) {
      this.skipButton.addEventListener("click", () => this.stop());
    }

    // Request notification permission on first interaction
    this.requestNotificationPermission();

    // Handle visibility changes (app switching on mobile)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.handleVisibilityReturn();
      }
    });

    // Resume timer if one was active
    this.resumeFromStorage();
  }

  // Request notification permission (for PWA)
  async requestNotificationPermissionPWA() {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      console.log("Notification permission:", permission);
    }
  }

  // Send timer to Service Worker for background notifications
  startServiceWorkerTimer(seconds) {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "START_TIMER",
        data: { seconds }
      });
      console.log("Timer sent to Service Worker");
    }
  }

  stopServiceWorkerTimer() {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "STOP_TIMER"
      });
    }
  }

  requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      // Request on first user interaction
      const requestOnInteraction = () => {
        Notification.requestPermission();
        document.removeEventListener("click", requestOnInteraction);
      };
      document.addEventListener("click", requestOnInteraction, { once: true });
    }
  }

  handleVisibilityReturn() {
    // When user returns to the page, check if timer should still be running
    const stored = localStorage.getItem(RestTimer.STORAGE_KEY);
    if (!stored) return;

    try {
      const { endTime } = JSON.parse(stored);
      const remaining = Math.ceil((endTime - Date.now()) / 1000);

      if (remaining <= 0) {
        // Timer finished while away
        this.complete();
      } else {
        // Update display with correct remaining time
        this.remainingSeconds = remaining;
        this.updateDisplay();
      }
    } catch (e) {
      // Ignore errors
    }
  }

  start(seconds) {
    // Request notification permission on first timer start
    this.requestNotificationPermissionPWA();

    this.stop(); // Clear any existing timer

    // Store the end time so we can resume after navigation
    const endTime = Date.now() + seconds * 1000;
    localStorage.setItem(RestTimer.STORAGE_KEY, JSON.stringify({ endTime }));

    // Also start timer in Service Worker for background notifications
    this.startServiceWorkerTimer(seconds);

    this.remainingSeconds = seconds;
    this.totalSeconds = seconds;
    this.timerElement.hidden = false;
    this.timerElement.classList.remove("rest-timer--complete");
    this.updateDisplay();

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  resumeFromStorage() {
    const stored = localStorage.getItem(RestTimer.STORAGE_KEY);
    if (!stored) return;

    try {
      const { endTime } = JSON.parse(stored);
      const remaining = Math.ceil((endTime - Date.now()) / 1000);

      if (remaining > 0) {
        this.remainingSeconds = remaining;
        this.timerElement.hidden = false;
        this.timerElement.classList.remove("rest-timer--complete");
        this.updateDisplay();

        this.intervalId = setInterval(() => {
          this.tick();
        }, 1000);
      } else if (remaining > -3) {
        // Timer just finished while away - show completion briefly
        this.showComplete();
      } else {
        // Timer finished a while ago - clean up
        localStorage.removeItem(RestTimer.STORAGE_KEY);
      }
    } catch (e) {
      localStorage.removeItem(RestTimer.STORAGE_KEY);
    }
  }

  tick() {
    this.remainingSeconds--;
    this.updateDisplay();

    if (this.remainingSeconds <= 0) {
      this.complete();
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    localStorage.removeItem(RestTimer.STORAGE_KEY);
    this.stopServiceWorkerTimer();
    this.timerElement.hidden = true;
    this.timerElement.classList.remove("rest-timer--complete");
  }

  complete() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    localStorage.removeItem(RestTimer.STORAGE_KEY);
    this.showComplete();
  }

  showComplete() {
    this.timerElement.hidden = false;
    this.timerElement.classList.add("rest-timer--complete");
    this.timeDisplay.textContent = "Done!";

    // Play sound
    this.playBeep();

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    // Show notification (works even if app is in background on some devices)
    this.showNotification();

    // Auto-hide after 3 seconds
    setTimeout(() => this.stop(), 3000);
  }

  playBeep() {
    if (!this.audioContext || !this.audioUnlocked) {
      console.log("Audio not unlocked, cannot play beep");
      return;
    }

    try {
      // Resume context if it got suspended
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      const playTone = (startTime, frequency, duration) => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        // Fade in and out to avoid clicks
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = this.audioContext.currentTime;
      playTone(now, 880, 0.15);        // A5 - first beep
      playTone(now + 0.2, 880, 0.15);  // A5 - second beep
      playTone(now + 0.4, 1108, 0.25); // C#6 - higher final beep
    } catch (e) {
      console.log("Audio playback error:", e);
    }
  }

  showNotification() {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification("Rest Complete", {
          icon: "/assets/images/logo-icon.svg",
          tag: "rest-timer", // Replaces existing notification
          requireInteraction: false,
          silent: false, // Allow sound
        });

        // Auto-close notification after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Focus window when notification clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        // Notifications not supported in this context
      }
    }
  }

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    this.timeDisplay.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

class SessionManager {
  constructor() {
    this.sessionId = this.getSessionId();
    this.autoSavers = new Map();
    this.restTimer = new RestTimer();
    this.init();
  }

  getSessionId() {
    // Extract session ID from URL
    const match = window.location.pathname.match(/\/sessions\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  init() {
    if (!this.sessionId) {
      return;
    }

    // Initialize auto-savers for each exercise card
    const exerciseCards = document.querySelectorAll(".exercise-card");
    exerciseCards.forEach((card) => {
      const sessionExerciseId = parseInt(
        card.dataset.sessionExerciseId
      );
      if (sessionExerciseId) {
        this.setupExerciseCard(card, sessionExerciseId);
      }
    });

    // Setup finish workout button
    this.setupFinishButton();
  }

  setupExerciseCard(card, sessionExerciseId) {
    const autoSave = new AutoSave(this.sessionId, sessionExerciseId);

    // Setup weight/reps inputs (debounced 1s)
    const weightInputs = card.querySelectorAll(".set-weight");
    const repsInputs = card.querySelectorAll(".set-reps");

    [...weightInputs, ...repsInputs].forEach((input) => {
      input.addEventListener("input", () => {
        const data = this.collectExerciseData(card, false);
        autoSave.saveDebounced("sets", data, 1000);
      });
    });

    // Setup notes textarea (debounced 2s)
    const notesTextarea = card.querySelector(".exercise-notes");
    if (notesTextarea) {
      notesTextarea.addEventListener("input", () => {
        const data = this.collectExerciseData(card, false);
        autoSave.saveDebounced("notes", data, 2000);
      });
    }

    // Setup set completion checkboxes (immediate + start timer)
    const doneCheckboxes = card.querySelectorAll(".set-done");
    const restSeconds = parseInt(card.dataset.restSeconds) || 0;
    doneCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const data = this.collectExerciseData(card, false);
        autoSave.saveImmediate(data);

        // Start rest timer when checking a set as done
        if (checkbox.checked && restSeconds > 0) {
          this.restTimer.start(restSeconds);
        }
      });
    });

    // Setup dropset checkbox (immediate)
    const dropsetCheckbox = card.querySelector(".dropset-done");
    if (dropsetCheckbox) {
      dropsetCheckbox.addEventListener("change", () => {
        const data = this.collectExerciseData(card, false);
        autoSave.saveImmediate(data);
      });
    }

    // Setup weight change buttons (mutually exclusive, immediate)
    const weightChangeButtons = card.querySelectorAll(".weight-change__btn");
    weightChangeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const isPressed = btn.getAttribute("aria-pressed") === "true";

        // Deselect all buttons first
        weightChangeButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));

        // Toggle this button (if it wasn't pressed, press it)
        if (!isPressed) {
          btn.setAttribute("aria-pressed", "true");
        }

        const data = this.collectExerciseData(card, true);
        autoSave.saveImmediate(data);
      });
    });

    this.autoSavers.set(sessionExerciseId, autoSave);
  }

  collectExerciseData(card, includeEffortTag = false) {
    const sessionExerciseId = parseInt(card.dataset.sessionExerciseId);
    const data = {
      sets: [],
    };

    // Collect notes
    const notesTextarea = card.querySelector(".exercise-notes");
    if (notesTextarea) {
      data.notes = notesTextarea.value.trim() || null;
    }

    // Collect dropset
    const dropsetCheckbox = card.querySelector(".dropset-done");
    if (dropsetCheckbox) {
      data.dropset_done = dropsetCheckbox.checked ? 1 : 0;
    }

    // Collect effort tag - only include when explicitly requested (user interaction)
    if (includeEffortTag) {
      const increaseBtn = card.querySelector('.weight-change__btn[data-effort-tag="increase"]');
      const decreaseBtn = card.querySelector('.weight-change__btn[data-effort-tag="decrease"]');
      if (increaseBtn?.getAttribute("aria-pressed") === "true") {
        data.effort_tag = "increase";
      } else if (decreaseBtn?.getAttribute("aria-pressed") === "true") {
        data.effort_tag = "decrease";
      } else {
        // Neither pressed = "good" (default state)
        data.effort_tag = "good";
      }
    }
    // If includeEffortTag is false, effort_tag is not included in data
    // This prevents overwriting None with "good" on weight/reps/notes changes

    // Collect sets
    const setRows = card.querySelectorAll(".set-row");
    setRows.forEach((row) => {
      const setNumber = parseInt(
        row.querySelector(".set-weight")?.dataset.setNumber
      );
      const weightInput = row.querySelector(".set-weight");
      const repsInput = row.querySelector(".set-reps");
      const doneCheckbox = row.querySelector(".set-done");

      if (setNumber && weightInput && repsInput && doneCheckbox) {
        const weight = parseFloat(weightInput.value) || 0;
        const reps = parseInt(repsInput.value) || 0;
        const isDone = doneCheckbox.checked ? 1 : 0;

        // Only include sets that have been started (weight or reps entered)
        if (weight > 0 || reps > 0 || isDone) {
          data.sets.push({
            set_number: setNumber,
            weight_kg: weight,
            reps: reps,
            is_done: isDone,
          });
        }
      }
    });

    return data;
  }

  setupFinishButton() {
    const finishButton = document.getElementById("finish-workout");
    const modal = document.getElementById("finish-modal");
    const backdrop = document.getElementById("modal-backdrop");
    const cancelBtn = document.getElementById("modal-cancel");
    const confirmBtn = document.getElementById("modal-confirm");

    if (!finishButton || !modal) {
      return;
    }

    const showModal = () => {
      modal.classList.add("is-visible");
      backdrop.classList.add("is-visible");
      confirmBtn.focus();
    };

    const hideModal = () => {
      modal.classList.remove("is-visible");
      backdrop.classList.remove("is-visible");
      finishButton.focus();
    };

    finishButton.addEventListener("click", showModal);
    cancelBtn.addEventListener("click", hideModal);
    backdrop.addEventListener("click", hideModal);

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-visible")) {
        hideModal();
      }
    });

    confirmBtn.addEventListener("click", async () => {
      hideModal();

      // Save all exercise data one final time
      const exerciseCards = document.querySelectorAll(".exercise-card");
      const savePromises = [];

      for (const card of exerciseCards) {
        const sessionExerciseId = parseInt(
          card.dataset.sessionExerciseId
        );
        const autoSave = this.autoSavers.get(sessionExerciseId);
        if (autoSave) {
          // Include effort_tag when finishing (final save should include all data)
          const data = this.collectExerciseData(card, true);
          // Only save if there are completed sets
          const hasCompletedSets = data.sets.some((s) => s.is_done === 1);
          if (hasCompletedSets) {
            savePromises.push(autoSave.saveImmediate(data));
          }
        }
      }

      // Wait for all saves to complete
      await Promise.all(savePromises);

      // Finish session
      try {
        finishButton.disabled = true;
        finishButton.textContent = "Finishing...";

        const response = await fetch(
          `/sessions/${this.sessionId}/finish`,
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          throw new Error(`Finish failed: ${response.statusText}`);
        }

        const result = await response.json();
        window.location.href = result.redirect || "/";
      } catch (error) {
        console.error("Finish error:", error);
        alert("Error finishing. Try again.");
        finishButton.disabled = false;
        finishButton.textContent = "Finish Workout";
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new SessionManager();
  });
} else {
  new SessionManager();
}
