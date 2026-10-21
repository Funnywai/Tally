import { EmptyState } from '../../components/EmptyState';
import { TrophyIcon } from '../../components/Icons';
import { Skeleton } from '../../components/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { fetchRanking } from '../../lib/api';
import { formatStatMoney } from '../../lib/money';

export function RankingTab({ refreshKey }: { readonly refreshKey: number }) {
  const ranking = useAsync(`ranking|${refreshKey}`, fetchRanking);

  return (
    <div className="ledger-panel">
      <div className="ledger-toolbar">
        <div>
          <p className="ledger-toolbar__title">排名榜</p>
          <p className="ledger-toolbar__meta">全期總額 · 由高至低</p>
        </div>
      </div>

      {ranking.loading ? <Skeleton lines={3} /> : null}

      {!ranking.loading && ranking.error !== null ? (
        <EmptyState
          title="載入失敗"
          description={ranking.error}
          actionLabel="重試"
          onAction={ranking.reload}
        />
      ) : null}

      {!ranking.loading && ranking.error === null && ranking.data !== null ? (
        ranking.data.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon size={24} />}
            title="尚無數據"
            description="寫入第一筆小氣簿後，排名會顯示在這裡。"
          />
        ) : (
          <div className="rank-wrap">
            <table className="rank-table">
              <thead>
                <tr>
                  <th scope="col">排名</th>
                  <th scope="col">玩家</th>
                  <th scope="col">贏/輸</th>
                  <th scope="col">金額</th>
                </tr>
              </thead>
              <tbody>
                {ranking.data.map((entry, index) => {
                  const tone =
                    entry.total > 0 ? 'is-positive' : entry.total < 0 ? 'is-negative' : 'is-zero';
                  return (
                    <tr key={entry.playerId}>
                      <td className="rank-table__rank">{index + 1}</td>
                      <td className="rank-table__name">{entry.name}</td>
                      <td className="rank-table__wl">
                        {entry.wins}/{entry.losses}
                      </td>
                      <td className={`rank-table__amount ${tone}`}>
                        {formatStatMoney(entry.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
