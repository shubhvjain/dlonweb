<script>
  import { getAllSettings } from './utils/settings.js';
	let file = $state(null);
	let error = $state('');
	let isLoading = $state(false);
  const { backendURL } = getAllSettings();

  async function convertModel() {
    error = '';
    if (!file) {
      error = 'Please select a .h5 file.';
      return;
    }

    isLoading = true;

    try {
      const formData = new FormData();
      formData.append('model', file);

      const response = await fetch(`${backendURL}/action/convert`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        error = errData.message || 'Conversion failed.';
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'model.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      error = err.message || 'Network or server error.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="row">
	<div class="col-lg-8 mx-auto">

    <h5 class="text-xl font-semibold pb-2 border-bottom">Convert Keras .h5 Model</h5>
    <input
    type="file"
    accept=".h5"
    onchange="{(e) => file = e.target.files[0]}"
    class="block"
  />

  <button
    onclick="{convertModel}"
    disabled="{isLoading}"
    class="btn btn-primary"
  >
    {isLoading ? 'Converting...' : 'Convert'}
  </button>

  {#if error}
    <div class="text-red-600 mt-2">{error}</div>
  {/if}
  </div>
</div>
