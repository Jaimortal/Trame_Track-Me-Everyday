/**
 * api.js - Client API service for TRAME
 * Performs all CRUD operations with the JSON primary database backend
 */

const API = {
  // Base endpoint
  BASE_URL: '/api',

  // GET all tasks (can filter by year, month, date, completed)
  async getTasks(filters = {}) {
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await fetch(`${this.BASE_URL}/tasks${query ? '?' + query : ''}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.tasks || [];
    } catch (err) {
      console.error('Failed to get tasks:', err);
      throw err;
    }
  },

  // GET single task by id
  async getTask(id) {
    try {
      const res = await fetch(`${this.BASE_URL}/tasks/${id}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.task;
    } catch (err) {
      console.error(`Failed to get task ${id}:`, err);
      throw err;
    }
  },

  // POST create a new task in JSON database
  async createTask(taskData) {
    try {
      const res = await fetch(`${this.BASE_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!res.ok) throw new Error(`Failed to create task`);
      return await res.json();
    } catch (err) {
      console.error('Failed to create task:', err);
      throw err;
    }
  },

  // PUT update existing task in JSON
  async updateTask(id, updateData) {
    try {
      const res = await fetch(`${this.BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error(`Failed to update task`);
      return await res.json();
    } catch (err) {
      console.error(`Failed to update task ${id}:`, err);
      throw err;
    }
  },

  // PATCH toggle completed state
  async toggleTask(id) {
    try {
      const res = await fetch(`${this.BASE_URL}/tasks/${id}/toggle`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error(`Failed to toggle task`);
      return await res.json();
    } catch (err) {
      console.error(`Failed to toggle task ${id}:`, err);
      throw err;
    }
  },

  // DELETE permanently remove task from JSON database
  async deleteTask(id) {
    try {
      const res = await fetch(`${this.BASE_URL}/tasks/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`Failed to delete task`);
      return await res.json();
    } catch (err) {
      console.error(`Failed to delete task ${id}:`, err);
      throw err;
    }
  },

  // POST cleanup completed tasks from JSON database to free space
  async cleanupCompleted(year = null) {
    try {
      const res = await fetch(`${this.BASE_URL}/tasks/cleanup-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      });
      if (!res.ok) throw new Error(`Failed to clean up tasks`);
      return await res.json();
    } catch (err) {
      console.error('Failed to cleanup completed tasks:', err);
      throw err;
    }
  },

  // GET summary statistics
  async getStats() {
    try {
      const res = await fetch(`${this.BASE_URL}/stats`);
      if (!res.ok) throw new Error(`Failed to get stats`);
      return await res.json();
    } catch (err) {
      console.error('Failed to get stats:', err);
      return { total: 0, completed: 0, pending: 0, completionRate: 0, dbFileSize: 0 };
    }
  },

  // GET live weather for Malaybalay City
  async getWeather() {
    try {
      const res = await fetch(`${this.BASE_URL}/weather`);
      if (!res.ok) throw new Error(`Failed to get weather`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error('Failed to fetch weather:', err);
      return null;
    }
  }
};

