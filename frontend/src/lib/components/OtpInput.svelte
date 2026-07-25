<script lang="ts">
  interface Props {
    length?: number;
    onComplete?: (code: string) => void;
    disabled?: boolean;
  }

  let { length = 6, onComplete, disabled = false }: Props = $props();

  let digits: string[] = $state(Array.from({ length }, () => ''));
  let inputs: (HTMLInputElement | undefined)[] = $state([]);

  const emitIfComplete = () => {
    const code = digits.join('');
    if (code.length === length && digits.every((digit) => digit !== '')) {
      onComplete?.(code);
    }
  };

  const focusAt = (index: number) => {
    const target = inputs[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  const handleInput = (index: number, event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const value = input.value.replaceAll(/\D/g, '');
    if (!value) {
      digits[index] = '';
      return;
    }
    digits[index] = value.at(-1)!;
    input.value = digits[index];
    if (index < length - 1) {
      focusAt(index + 1);
    }
    emitIfComplete();
  };

  const handleKeydown = (index: number, event: KeyboardEvent) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      digits[index - 1] = '';
      focusAt(index - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1);
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      focusAt(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text') ?? '').replaceAll(/\D/g, '').slice(0, length);
    if (!text) {
      return;
    }
    for (let i = 0; i < length; i++) {
      digits[i] = text[i] ?? '';
    }
    focusAt(Math.min(text.length, length - 1));
    emitIfComplete();
  };
</script>

<div class="flex justify-center gap-2" role="group" aria-label="One-time code">
  {#each digits as digit, index (index)}
    <input
      bind:this={inputs[index]}
      bind:value={digits[index]}
      type="text"
      inputmode="numeric"
      autocomplete={index === 0 ? 'one-time-code' : 'off'}
      maxlength="1"
      {disabled}
      oninput={(event) => handleInput(index, event)}
      onkeydown={(event) => handleKeydown(index, event)}
      onpaste={handlePaste}
      class="h-13 w-11 rounded-xl border border-white/15 bg-white/5 text-center font-mono text-xl font-semibold text-white caret-cyan-300 transition-colors outline-none focus:border-cyan-400/70 focus:bg-white/10 disabled:opacity-50"
      aria-label={`Digit ${index + 1}`}
    />
  {/each}
</div>
