/**
 * Auto-save functionality with debouncing
 */

export class AutoSave {
  constructor(sessionId, sessionExerciseId) {
    this.sessionId = sessionId;
    this.sessionExerciseId = sessionExerciseId;
    this.debounceTimers = new Map();
    this.saving = false;
    this.pendingData = null;
  }

  /**
   * Debounced save function
   */
  debounce(key, fn, delay) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    const timer = setTimeout(() => {
      fn();
      this.debounceTimers.delete(key);
    }, delay);
    this.debounceTimers.set(key, timer);
  }

  /**
   * Merge two data objects, with the second taking precedence for overlapping fields
   */
  mergeData(existing, incoming) {
    const merged = { ...existing };
    
    // Merge sets - combine arrays and update/insert by set_number
    if (incoming.sets && incoming.sets.length > 0) {
      if (!merged.sets) {
        merged.sets = [];
      }
      // Create a map of existing sets by set_number
      const setsMap = new Map(merged.sets.map(s => [s.set_number, s]));
      // Update or add incoming sets
      incoming.sets.forEach(incomingSet => {
        setsMap.set(incomingSet.set_number, incomingSet);
      });
      merged.sets = Array.from(setsMap.values());
    }
    
    // Merge other fields - incoming takes precedence if present
    if (incoming.notes !== undefined) {
      merged.notes = incoming.notes;
    }
    if (incoming.effort_tag !== undefined) {
      merged.effort_tag = incoming.effort_tag;
    }
    if (incoming.dropset_done !== undefined) {
      merged.dropset_done = incoming.dropset_done;
    }
    
    return merged;
  }

  /**
   * Save exercise data to server
   * If a save is in progress, queues the data to be merged and saved after
   */
  async save(data) {
    // If a save is in progress, merge with pending data and return
    // The current save will process pending data when it completes
    if (this.saving) {
      if (this.pendingData) {
        this.pendingData = this.mergeData(this.pendingData, data);
      } else {
        this.pendingData = data;
      }
      // Don't wait - let the current save handle it
      return;
    }

    // Start save immediately
    await this.performSave(data);
    
    // After save completes, check for pending data
    // Process it recursively (which will set saving flag again)
    if (this.pendingData) {
      const pending = this.pendingData;
      this.pendingData = null;
      return this.save(pending);
    }
  }

  /**
   * Perform the actual save operation
   */
  async performSave(data) {
    this.saving = true;
    try {
      const response = await fetch(
        `/sessions/${this.sessionId}/exercises/${this.sessionExerciseId}/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Auto-save error:", error);
      // TODO: Show user-friendly error message
      throw error;
    } finally {
      this.saving = false;
    }
  }

  /**
   * Save immediately (for checkboxes)
   */
  async saveImmediate(data) {
    return this.save(data);
  }

  /**
   * Save with debounce (for inputs)
   */
  saveDebounced(key, data, delay) {
    this.debounce(key, () => this.save(data), delay);
  }
}

