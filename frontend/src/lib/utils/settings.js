const STORAGE_KEY = 'dlonwebsetting';

// Static system settings (read-only)
const SYSTEM_SETTINGS = {
  languages: [
    { title: "English", key: "en" },
    { title: "Deutsch", key: "de" }
  ],
  meta:{
    name:"FLonWeb.js",
    
  },
  sections:{
    server:false,
    training:false,
    custom_inference:false,
  },
  contact:{
    github:"https://github.com/shubhvjain/dlonweb1",
    email:"shubhvjain@gmail.com"
  }
};

const DEFAULT_USER_SETTINGS = {
  backendURL: 'http://localhost:3000',
  theme: 'light',
  language: 'en'
};

// ================= User Settings =================

// Get all user settings
export function getAllSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  let userSettings = {};

  if (raw) {
    try {
      userSettings = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse user settings from localStorage", e);
    }
  }

  // Merge defaults with user settings
  return { ...DEFAULT_USER_SETTINGS, ...userSettings };
}

// Save all user settings
export function saveAllSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save user settings to localStorage", e);
  }
}

// Update a single user setting
export function updateSetting(key, value) {
  const settings = getAllSettings();
  settings[key] = value;
  saveAllSettings(settings);
}

// Reset user settings
export function resetUserSettings() {
  localStorage.removeItem(STORAGE_KEY);
}

// ================= System Settings =================

// Get all system settings
export function getSystemSettings() {
  return { ...SYSTEM_SETTINGS };
}

// Get a single system setting
export function getSystemSetting(key) {
  return SYSTEM_SETTINGS[key];
}
