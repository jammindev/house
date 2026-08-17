import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import type { BankTransaction } from '@/lib/api/banking';
import TransactionRow from './TransactionRow';

interface TransactionListProps {
  transactions: BankTransaction[];
  total: number;
  canFeedCash: boolean;
  onToggleInternal: (transaction: BankTransaction) => void;
  onEditNote: (transaction: BankTransaction) => void;
  onFeedCash: (transaction: BankTransaction) => void;
  onUnlinkCash: (transaction: BankTransaction) => void;
  onLinkTransfer: (transaction: BankTransaction) => void;
  onAllocate: (transaction: BankTransaction) => void;
  onSuggest: (transaction: BankTransaction) => void;
  onClassify: (transaction: BankTransaction) => void;
}

export default function TransactionList({
  transactions,
  total,
  canFeedCash,
  onToggleInternal,
  onEditNote,
  onFeedCash,
  onUnlinkCash,
  onLinkTransfer,
  onAllocate,
  onSuggest,
  onClassify,
}: TransactionListProps) {
  const { t } = useTranslation();

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title={t('banking.journal.empty.title')}
        description={t('banking.journal.empty.description')}
      />
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          canFeedCash={canFeedCash}
          onToggleInternal={() => onToggleInternal(transaction)}
          onEditNote={() => onEditNote(transaction)}
          onFeedCash={() => onFeedCash(transaction)}
          onUnlinkCash={() => onUnlinkCash(transaction)}
          onLinkTransfer={() => onLinkTransfer(transaction)}
          onAllocate={() => onAllocate(transaction)}
          onSuggest={() => onSuggest(transaction)}
          onClassify={() => onClassify(transaction)}
        />
      ))}

      {total > transactions.length ? (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          {t('banking.journal.showing', { shown: transactions.length, total })}
        </p>
      ) : null}
    </div>
  );
}
