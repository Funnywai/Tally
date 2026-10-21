import { PencilIcon, SwapIcon, UndoIcon, WrenchIcon } from './Icons';
import { Sheet } from './Sheet';

export type ToolAction = 'reset' | 'rename' | 'swap' | 'undo';

interface ToolsSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onAction: (action: ToolAction) => void;
}

const TOOLS: readonly {
  readonly action: ToolAction;
  readonly label: string;
  readonly danger: boolean;
}[] = [
  { action: 'undo', label: '復原', danger: false },
  { action: 'rename', label: '改名', danger: false },
  { action: 'swap', label: '換位', danger: false },
  { action: 'reset', label: '重設牌局', danger: true },
];

export function ToolsSheet({ open, onClose, onAction }: ToolsSheetProps) {
  return (
    <Sheet open={open} title="工具" onClose={onClose}>
      <div className="tool-list">
        {TOOLS.map((tool) => {
          const Icon =
            tool.action === 'undo'
              ? UndoIcon
              : tool.action === 'rename'
                ? PencilIcon
                : tool.action === 'swap'
                  ? SwapIcon
                  : WrenchIcon;
          return (
            <button
              key={tool.action}
              type="button"
              className={`tool-row ${tool.danger ? 'is-danger' : ''}`}
              onClick={() => onAction(tool.action)}
            >
              <span className="tool-row__icon">
                <Icon size={20} />
              </span>
              <span className="tool-row__text">
                <span className="tool-row__label">{tool.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
