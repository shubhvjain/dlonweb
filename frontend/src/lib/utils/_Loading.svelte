<script>
  let {message="Loading"} = $props()

</script>

<style>    
 
    .loading {
      display: flex;
      align-items: center;
    }

    .dots {
      display: flex;
      margin-left: 10px;
    }

    .dot {
      width: 6px;
      height: 6px;
      margin: 0 3px;
      background: grey;
      border-radius: 50%;
      animation: bounce 1.2s infinite ease-in-out;
    }

    .dot:nth-child(1) {
      animation-delay: 0s;
    }

    .dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes bounce {
      0%, 80%, 100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(-10px);
      }
    }
  </style>

  <div class="loading m-2 p-2">
    {message}
    <div class="dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  </div>

