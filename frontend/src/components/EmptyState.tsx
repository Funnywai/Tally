import type { ReactNode } from 'react';
import { AlertIcon } from './Icons';

interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon ?? <AlertIcon size={24} />}</span>
      <p className="empty-state__title">{title}</p>
      {description === undefined ? null : <p className="empty-state__description">{description}</p>}
      {actionLabel === undefined || onAction === undefined ? null : (
        <button type="button" className="button button--outline button--small" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
