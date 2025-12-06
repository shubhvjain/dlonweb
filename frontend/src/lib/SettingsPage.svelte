<script>
  import { onMount } from 'svelte';
  import { getAllSettings, saveAllSettings, getSystemSettings } from './utils/settings.js';
  import axios from 'axios';

  let settings = $state({});
  let systemSettings = $state({});
  let backendPingStatus = $state('');
  let libraryPingStatus = $state('');
  let backendLoading = $state(false);
  let libraryLoading = $state(false);

  // Load settings once on component mount
  onMount(() => {
    settings = getAllSettings();
    systemSettings = getSystemSettings();
  });

  function saveSettings() {
    saveAllSettings(settings);
  }

  async function pingBackendServer() {
    if (!settings.backendURL) {
      backendPingStatus = 'Please enter backend URL first.';
      return;
    }

    backendLoading = true;
    backendPingStatus = 'Pinging...';

    try {
      const response = await axios.get(`${settings.backendURL}/`);
      if (response.data.success) {
        backendPingStatus = `Server is up: ${response.data.message}`;
      } else {
        backendPingStatus = 'Server responded but success=false';
      }
    } catch (error) {
      backendPingStatus = 'Server is unreachable.';
      console.error(error);
    } finally {
      backendLoading = false;
    }
  }

  async function pingLibraryServer() {
    if (!settings.library_server) {
      libraryPingStatus = 'Please enter library server URL first.';
      return;
    }

    libraryLoading = true;
    libraryPingStatus = 'Pinging...';

    try {
      const response = await axios.get(`${settings.library_server}`);
      libraryPingStatus = `Library server is reachable: ${response.status} ${response.statusText}`;
    } catch (error) {
      libraryPingStatus = 'Library server is unreachable.';
      console.error(error);
    } finally {
      libraryLoading = false;
    }
  }
</script>

<div class="row">
  <div class="col-lg-8 mx-auto">
    <h5 class="text-xl font-semibold pb-2 border-bottom">Settings</h5>

    <div class="mb-4">
      <label class="form-label" for="backend_url">Server URL</label>
      <div class="form-text">DLON backend server URL (default: http://localhost:3000). Should respond to GET / with success=true.</div>
      <input 
        type="url" 
        id="backend_url"
        name="backend_url" 
        bind:value={settings.backendURL} 
        class="form-control" 
        placeholder="http://localhost:3000" 
      />
      <div class="mt-2">
        <button class="btn btn-success btn-sm me-2" onclick={pingBackendServer} disabled={backendLoading}>
          {#if backendLoading}
            Pinging...
          {:else}
            Ping Backend
          {/if}
        </button>
        <a href={settings.backendURL || '#'} class="btn btn-outline-primary btn-sm" target="_blank" rel="noopener">
          How to set up server
        </a>
      </div>
      {#if backendPingStatus}
        <p class="mt-2 text-info small">{backendPingStatus}</p>
      {/if}
    </div>

    <div class="mb-4">
      <label class="form-label" for="theme">Theme</label>
      <div class="form-text">Application color theme preference.</div>
      <select id="theme" name="theme" bind:value={settings.theme} class="form-control">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div class="mb-4">
      <label class="form-label" for="language">Language</label>
      <div class="form-text">Application display language from available options.</div>
      <select id="language" name="language" bind:value={settings.language} class="form-control">
        {#each systemSettings.languages || [] as lang}
          <option value={lang.key}>{lang.title}</option>
        {/each}
      </select>
    </div>

    <div class="mb-4">
      <label class="form-label" for="library_server">Library Server</label>
      <div class="form-text">Model library JSON index URL (default: http://127.0.0.1:5500/library/index.json).</div>
      <input 
        type="url" 
        id="library_server"
        name="library_server" 
        bind:value={settings.library_server} 
        class="form-control" 
        placeholder="http://127.0.0.1:5500/library/index.json" 
      />
      <div class="mt-2">
        <button class="btn btn-info btn-sm" onclick={pingLibraryServer} disabled={libraryLoading}>
          {#if libraryLoading}
            Pinging...
          {:else}
            Ping Library
          {/if}
        </button>
      </div>
      {#if libraryPingStatus}
        <p class="mt-2 text-info small">{libraryPingStatus}</p>
      {/if}
    </div>

    <button class="btn btn-primary w-100" onclick={saveSettings}>Save Settings</button>
  </div>
</div>
