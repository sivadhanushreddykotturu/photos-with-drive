<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0B1026] p-4">
  <!-- Signature: drifting aurora light-pool -->
  <div class="aurora-orb" aria-hidden="true"></div>
  <div class="aurora-orb aurora-orb--second" aria-hidden="true"></div>

  <div class="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
    <p class="mb-6 font-mono text-xs tracking-[0.3em] text-cyan-300/80 uppercase">PhotoDrive</p>
    {@render children?.()}
  </div>
</div>

<style>
  .aurora-orb {
    position: absolute;
    width: 60vmax;
    height: 60vmax;
    top: -25vmax;
    right: -15vmax;
    border-radius: 9999px;
    background: radial-gradient(circle at 35% 35%, rgba(99, 102, 241, 0.35), rgba(6, 182, 212, 0.12) 55%, transparent 70%);
    filter: blur(40px);
    animation: drift 18s ease-in-out infinite alternate;
  }

  .aurora-orb--second {
    top: auto;
    right: auto;
    bottom: -30vmax;
    left: -20vmax;
    background: radial-gradient(circle at 60% 60%, rgba(6, 182, 212, 0.28), rgba(99, 102, 241, 0.1) 55%, transparent 70%);
    animation-duration: 22s;
    animation-direction: alternate-reverse;
  }

  @keyframes drift {
    from {
      transform: translate3d(0, 0, 0) scale(1);
    }
    to {
      transform: translate3d(-6vmax, 4vmax, 0) scale(1.15);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .aurora-orb {
      animation: none;
    }
  }
</style>
