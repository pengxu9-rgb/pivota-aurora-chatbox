import React, { useState } from 'react';

interface ChipData {
  action_id: string;
  label: string;
}

interface ActionData {
  action_id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

interface ChipsPayload {
  chips: ChipData[];
  actions?: ActionData[];
}

interface ChipsMessageProps {
  payload: ChipsPayload;
  onAction: (actionId: string) => void;
}

export function ChipsMessage({ payload, onAction }: ChipsMessageProps) {
  const { chips, actions } = payload;
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  const handleChipClick = (actionId: string) => {
    if (isDisabled) return;
    setSelectedChip(actionId);
    setIsDisabled(true);
    onAction(actionId);
  };

  const handleActionClick = (actionId: string) => {
    if (isDisabled) return;
    setIsDisabled(true);
    onAction(actionId);
  };

  return (
    <div className="chat-card space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.action_id}
              onClick={() => handleChipClick(chip.action_id)}
              disabled={isDisabled}
              className={`chip-button transition-opacity ${
                selectedChip === chip.action_id ? 'chip-button-primary' : ''
              } ${isDisabled && selectedChip !== chip.action_id ? 'opacity-50' : ''}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const variantClass = 
              action.variant === 'primary' ? 'chip-button-primary' :
              action.variant === 'outline' ? 'chip-button-outline' :
              'chip-button';
            
            return (
              <button
                key={action.action_id}
                onClick={() => handleActionClick(action.action_id)}
                disabled={isDisabled}
                className={`${variantClass} ${isDisabled ? 'opacity-50' : ''}`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}