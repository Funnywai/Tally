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
  readonly description: string;
  readonly danger: boolean;
}[] = [
  { action: 'undo', label: '復原', description: '復原上一次找數、除數、賞罰或飯錢', danger: false },
  { action: 'rename', label: '改名', description: '修改四位玩家的顯示名稱', danger: false },
  { action: 'swap', label: '換位', description: '交換兩位玩家的名稱與分數', danger: false },
  { action: 'reset', label: '重設牌局', description: '清空今日番數與埋數，保留名稱', danger: true },
];

export function ToolsSheet({ open, onClose, onAction }: ToolsSheetProps) {
  return (
    <Sheet open={open} title="工具" description="牌局輔助操作" onClose={onClose}>
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
                <span className="tool-row__description">{tool.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
