import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { OptionCardGroup, PromptFooter, PromptHeader } from '@/components/prompt';

function SingleSelectHarness() {
  const [value, setValue] = useState<string | null>('a');
  return (
    <OptionCardGroup
      selectionMode="single"
      ariaLabel="Single-select keyboard smoke"
      options={[
        { id: 'a', label: 'Option A' },
        { id: 'b', label: 'Option B' },
        { id: 'c', label: 'Option C' },
      ]}
      value={value}
      onChange={(nextValue) => {
        if (typeof nextValue === 'string') setValue(nextValue);
      }}
    />
  );
}

function MultiSelectHarness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <OptionCardGroup
      selectionMode="multiple"
      ariaLabel="Multi-select keyboard smoke"
      options={[
        { id: 'x', label: 'Option X' },
        { id: 'y', label: 'Option Y' },
      ]}
      value={value}
      onChange={(nextValue) => {
        if (Array.isArray(nextValue)) setValue(nextValue);
      }}
    />
  );
}

describe('prompt system hardening', () => {
  it('renders long EN prompt content in narrow width with clamped header and multiline options', () => {
    render(
      <div style={{ width: '320px' }}>
        <PromptHeader
          language="EN"
          title="How would you describe your skin behavior under varying conditions throughout a long and demanding day?"
          helper="This intentionally long helper verifies two-line clamping and avoids narrow-width layout overflow in prompt surfaces."
        />
        <OptionCardGroup
          selectionMode="single"
          ariaLabel="Long copy stress"
          options={[
            {
              id: 'verbose',
              label:
                'A very long option title that should wrap naturally without clipping, preserving readability and tap target integrity.',
              description:
                'Additional explanatory text to force multiline option rendering while maintaining visual structure.',
            },
          ]}
          value={null}
          onChange={() => undefined}
        />
        <PromptFooter language="EN" onPrimary={() => undefined} primaryLabel="Continue" tertiaryHidden />
      </div>,
    );

    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveClass('prompt-title');
    expect(title).toHaveClass('prompt-line-2');
    expect(screen.getByText(/intentionally long helper/i)).toHaveClass('prompt-line-2');
    expect(screen.getByRole('radio', { name: /very long option title/i })).toHaveClass('prompt-option-card-multiline');
  });

  it('exposes radiogroup/checkbox semantics and supports arrow-key navigation for single-select', () => {
    render(
      <div>
        <SingleSelectHarness />
        <MultiSelectHarness />
      </div>,
    );

    const radioGroup = screen.getByRole('radiogroup', { name: 'Single-select keyboard smoke' });
    const radios = screen.getAllByRole('radio');
    expect(radioGroup).toBeInTheDocument();
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    (radios[0] as HTMLButtonElement).focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');

    const checkboxGroup = screen.getByRole('group', { name: 'Multi-select keyboard smoke' });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxGroup).toBeInTheDocument();
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');
  });
});
