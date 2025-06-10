// settings.js

const STORAGE_KEY = 'dlonwebsetting';

export function getAllSettings() {
  let default_vals = {
    backendURL: 'http://localhost:3000',
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return default_vals;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse settings from localStorage", e);
    return default_vals;
  }
}

export function saveAllSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
}
