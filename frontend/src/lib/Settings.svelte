<script>
  import { onMount } from 'svelte';
  import { getAllSettings, saveAllSettings } from './settings.js';
  import axios from 'axios';
  let settings = $state({});

  // Load settings once on component mount
  onMount(() => {
    const storedSettings = getAllSettings();
    settings = { ...settings, ...storedSettings };
  });

  function saveSettings() {
    saveAllSettings(settings);
    //alert('Settings saved!');
  }

  let pingStatus = $state(''); // message to show ping result
  let loading = $state(false)

  async function pingServer() {
    if (!settings.backendURL) {
      pingStatus = '⚠️ Please enter backend URL first.';
      return;
    }

    loading = true;
    pingStatus = 'Pinging...';

    try {
      // Make GET request to backendURL + '/'
      const response = await axios.get(`${settings.backendURL}/`);
      if (response.data.success) {
        pingStatus = `✅ Server is up: ${response.data.message}`;
      } else {
        pingStatus = '⚠️ Server responded but success=false';
      }
    } catch (error) {
      pingStatus = '❌ Server is unreachable.';
      console.error(error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="row">
	<div class="col-lg-8 mx-auto">

    <h5 class="text-xl font-semibold pb-2 border-bottom">Settings</h5>

    <label class="p-2" for="backend_url">Backend URL</label> 
        <input type="text" name="backend_url" bind:value={settings.backendURL} class="form-control mb-3" placeholder="Enter backend URL" />


        <button class="btn btn-success" onclick={pingServer} disabled={loading}>
          {#if loading}
            Pinging...
          {:else}
            Ping server
          {/if}
        </button>

        {#if pingStatus}
          <p class="mt-3">{pingStatus}</p>
        {/if}
        <br>
        <button class="btn btn-primary mt-3" onclick={saveSettings}>Save Settings</button>
  </div>
</div>