import { useEffect, useState } from 'react';

interface NameInputProps {
  readonly value: string;
  readonly label: string;
  readonly onCommit: (value: string) => void;
}

export function NameInput({ value, label, onCommit }: NameInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      className="name-input"
      value={draft}
      maxLength={7}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() !== value) {
          onCommit(draft);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      onFocus={(event) => event.currentTarget.select()}
    />
  );
}
