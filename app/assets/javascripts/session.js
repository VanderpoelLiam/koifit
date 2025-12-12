/**
 * Session management and auto-save coordination
 */
import { AutoSave } from "./auto-save.js";

class SessionManager {
  constructor() {
    this.sessionId = this.getSessionId();
    this.autoSavers = new Map();
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

    // Setup set completion checkboxes (immediate)
    const doneCheckboxes = card.querySelectorAll(".set-done");
    doneCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const data = this.collectExerciseData(card, false);
        autoSave.saveImmediate(data);
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

    // Setup effort tags (mutually exclusive, immediate)
    const effortIncrease = card.querySelector(".effort-increase");
    const effortDecrease = card.querySelector(".effort-decrease");

    if (effortIncrease) {
      effortIncrease.addEventListener("change", () => {
        if (effortIncrease.checked && effortDecrease) {
          effortDecrease.checked = false;
        }
        const data = this.collectExerciseData(card, true);
        autoSave.saveImmediate(data);
      });
    }

    if (effortDecrease) {
      effortDecrease.addEventListener("change", () => {
        if (effortDecrease.checked && effortIncrease) {
          effortIncrease.checked = false;
        }
        const data = this.collectExerciseData(card, true);
        autoSave.saveImmediate(data);
      });
    }

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
      const effortIncrease = card.querySelector(".effort-increase");
      const effortDecrease = card.querySelector(".effort-decrease");
      if (effortIncrease?.checked) {
        data.effort_tag = "increase";
      } else if (effortDecrease?.checked) {
        data.effort_tag = "decrease";
      } else {
        // Neither checked = "good" (default state)
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
    if (!finishButton) {
      return;
    }

    finishButton.addEventListener("click", async () => {
      // Confirm before finishing
      if (!confirm("Are you sure you want to finish this workout?")) {
        return;
      }

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
        alert("Error finishing workout. Please try again.");
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

