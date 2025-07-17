<script>
  import { marked } from 'marked';
   let {markdown=""} = $props();

  // Optional: sanitize if you need to
  let html = $derived(marked.parse(markdown));

  function htmlContent(node) {
    node.innerHTML = html;
  }
</script>

<div class="markdown-body" use:htmlContent></div>



<style>
  .markdown-body {
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3 {
    margin-top: 1rem;
  }

  .markdown-body code {
    background: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }

  .markdown-body pre {
    background: #f5f5f5;
    padding: 1em;
    overflow-x: auto;
    border-radius: 6px;
  }
</style>
