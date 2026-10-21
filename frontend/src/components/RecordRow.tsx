import type { RecordItem } from '../lib/api';
import { formatTimeHK } from '../lib/date';
import { formatSignedScore } from '../lib/money';
import { PencilIcon, TrashIcon } from './Icons';

interface RecordRowProps {
  readonly record: RecordItem;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

export function RecordRow({ record, onEdit, onDelete }: RecordRowProps) {
  const time = formatTimeHK(new Date(record.recordedAt));

  return (
    <article className="record-row">
      <div className="record-row__players">
        {record.players.map((player) => {
          const tone =
            player.score > 0 ? 'is-positive' : player.score < 0 ? 'is-negative' : 'is-zero';
          return (
            <div key={player.playerId} className="record-player">
              <span className="record-player__name">{player.name}</span>
              <span className={`record-player__score ${tone}`}>
                {formatSignedScore(player.score)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="record-row__actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`編輯 ${record.date} ${time} 的記錄`}
          onClick={onEdit}
        >
          <PencilIcon size={16} />
        </button>
        <button
          type="button"
          className="icon-button is-danger"
          aria-label={`刪除 ${record.date} ${time} 的記錄`}
          onClick={onDelete}
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </article>
  );
}
