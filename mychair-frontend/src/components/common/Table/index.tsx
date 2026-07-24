import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import { cn } from '../../../utils/cn';
import Button from '../Button';
import CommonChips from '../Chips';
import { EmptyState, TableLoader } from '../Loader';
import CommonPagination from '../Pagination';
import CommonSearch from '../Search';
import CommonTooltip from '../Tooltip';

type SortDirection = 'asc' | 'desc';
type Align = 'left' | 'center' | 'right';

export interface CommonTableColumn<T> {
  key: string;
  header: React.ReactNode;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  type?: 'text' | 'status' | 'date' | 'custom';
  align?: Align;
  className?: string;
  headerClassName?: string;
}

export interface CommonTableAction<T> {
  type?: 'view' | 'edit' | 'delete' | 'more' | 'custom';
  label?: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  className?: string;
}

export interface CommonTableProps<T> {
  data: T[];
  columns: CommonTableColumn<T>[];
  rowKey: keyof T | ((row: T, index: number) => React.Key);
  actions?: CommonTableAction<T>[];
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  filters?: React.ReactNode;
  loading?: boolean;
  stickyHeader?: boolean;
  enableGlobalSearch?: boolean;
  globalSearchPlaceholder?: string;
  columnSearch?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: boolean;
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  manualPagination?: boolean;
  manualSorting?: boolean;
  manualFiltering?: boolean;
  onSortChange?: (key: string, direction: SortDirection | null) => void;
  onSearchChange?: (value: string) => void;
  onColumnSearchChange?: (key: string, value: string) => void;
  className?: string;
}

const alignClasses: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const actionIcons = {
  view: <Eye className="h-4 w-4" />,
  edit: <Pencil className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  more: <MoreHorizontal className="h-4 w-4" />,
  custom: <MoreHorizontal className="h-4 w-4" />,
};

const getValue = <T,>(row: T, column: CommonTableColumn<T>) => {
  if (typeof column.accessor === 'function') return column.accessor(row);
  if (column.accessor) return row[column.accessor];
  return (row as Record<string, unknown>)[column.key];
};

const stringifyValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (React.isValidElement(value)) return '';
  return String(value).toLowerCase();
};

const CommonTable = <T,>({
  data,
  columns,
  rowKey,
  actions,
  title,
  subtitle,
  filters,
  loading = false,
  stickyHeader = true,
  enableGlobalSearch = true,
  globalSearchPlaceholder = 'Search table...',
  columnSearch = false,
  emptyTitle = 'No salon records yet',
  emptyDescription = 'Try changing your search, clearing filters, or adding a new record.',
  pagination = true,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  onSortChange,
  onSearchChange,
  onColumnSearchChange,
  className,
}: CommonTableProps<T>) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnSearchValues, setColumnSearchValues] = useState<Record<string, string>>({});
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pageSize ?? 10);

  const currentPage = page ?? internalPage;
  const currentPageSize = pageSize ?? internalPageSize;

  const processedData = useMemo(() => {
    let nextData = [...data];

    if (!manualFiltering) {
      const normalizedGlobalSearch = globalSearch.trim().toLowerCase();
      if (normalizedGlobalSearch) {
        nextData = nextData.filter((row) =>
          columns.some((column) => stringifyValue(getValue(row, column)).includes(normalizedGlobalSearch))
        );
      }

      Object.entries(columnSearchValues).forEach(([key, value]) => {
        const normalizedValue = value.trim().toLowerCase();
        if (!normalizedValue) return;

        const column = columns.find((item) => item.key === key);
        if (!column) return;

        nextData = nextData.filter((row) =>
          stringifyValue(getValue(row, column)).includes(normalizedValue)
        );
      });
    }

    if (!manualSorting && sortKey && sortDirection) {
      const column = columns.find((item) => item.key === sortKey);
      if (column) {
        nextData.sort((firstRow, secondRow) => {
          const firstValue = stringifyValue(getValue(firstRow, column));
          const secondValue = stringifyValue(getValue(secondRow, column));
          return sortDirection === 'asc'
            ? firstValue.localeCompare(secondValue)
            : secondValue.localeCompare(firstValue);
        });
      }
    }

    return nextData;
  }, [columnSearchValues, columns, data, globalSearch, manualFiltering, manualSorting, sortDirection, sortKey]);

  const visibleData = useMemo(() => {
    if (!pagination || manualPagination) return processedData;

    const start = (currentPage - 1) * currentPageSize;
    return processedData.slice(start, start + currentPageSize);
  }, [currentPage, currentPageSize, manualPagination, pagination, processedData]);

  const resolvedTotalItems = totalItems ?? processedData.length;
  const hasActions = !!actions?.length;
  const searchableColumns = columns.filter((column) => column.searchable);

  const resolveRowKey = (row: T, index: number) =>
    typeof rowKey === 'function' ? rowKey(row, index) : (row[rowKey] as React.Key);

  const handleSort = (column: CommonTableColumn<T>) => {
    if (!column.sortable) return;

    const nextDirection =
      sortKey !== column.key ? 'asc' : sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc';

    setSortKey(nextDirection ? column.key : null);
    setSortDirection(nextDirection);
    onSortChange?.(column.key, nextDirection);
  };

  const handleGlobalSearch = (value: string) => {
    setGlobalSearch(value);
    setInternalPage(1);
    onSearchChange?.(value);
  };

  const handleColumnSearch = (key: string, value: string) => {
    setColumnSearchValues((current) => ({ ...current, [key]: value }));
    setInternalPage(1);
    onColumnSearchChange?.(key, value);
  };

  const handlePageChange = (nextPage: number) => {
    setInternalPage(nextPage);
    onPageChange?.(nextPage);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setInternalPageSize(nextPageSize);
    setInternalPage(1);
    onPageSizeChange?.(nextPageSize);
  };

  return (
    <section className={cn('overflow-hidden rounded-3xl border border-[var(--color-border-soft)] bg-white shadow-card', className)}>
      {(title || subtitle || filters || enableGlobalSearch) && (
        <div className="flex flex-col gap-4 border-b border-[var(--color-border-soft)] p-4 lg:flex-row lg:items-center lg:justify-between">
          {(title || subtitle) && (
            <div>
              {title && <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {enableGlobalSearch && (
              <CommonSearch
                value={globalSearch}
                onChange={handleGlobalSearch}
                placeholder={globalSearchPlaceholder}
                containerClassName="w-full sm:min-w-72"
              />
            )}
            {filters}
          </div>
        </div>
      )}

      {columnSearch && searchableColumns.length > 0 && (
        <div className="grid gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] p-4 md:grid-cols-2 xl:grid-cols-4">
          {searchableColumns.map((column) => (
            <CommonSearch
              key={column.key}
              value={columnSearchValues[column.key] ?? ''}
              onChange={(value) => handleColumnSearch(column.key, value)}
              placeholder={column.searchPlaceholder ?? `Search ${String(column.header)}`}
              containerClassName="min-h-10 rounded-xl"
            />
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border-soft)] text-sm">
          <thead className={cn('bg-[#fbf8f1]', stickyHeader && 'sticky top-0 z-10')}>
            <tr>
              {columns.map((column) => {
                const isActiveSort = sortKey === column.key && sortDirection;
                const align = column.align ?? 'left';
                return (
                  <th
                    key={column.key}
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase',
                      alignClasses[align],
                      column.headerClassName
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      disabled={!column.sortable}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg transition',
                        column.sortable && 'cursor-pointer hover:text-[var(--color-brand-gold-dark)]',
                        !column.sortable && 'cursor-default'
                      )}
                    >
                      {column.header}
                      {column.sortable &&
                        (isActiveSort ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-[var(--color-brand-gold-dark)]" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-[var(--color-brand-gold-dark)]" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                        ))}
                    </button>
                  </th>
                );
              })}
              {hasActions && (
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)] bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)}>
                  <TableLoader rows={currentPageSize > 10 ? 10 : currentPageSize} columns={columns.length + (hasActions ? 1 : 0)} />
                </td>
              </tr>
            ) : visibleData.length ? (
              visibleData.map((row, rowIndex) => (
                <tr key={resolveRowKey(row, rowIndex)} className="transition hover:bg-[var(--color-surface-bg)]">
                  {columns.map((column) => {
                    const align = column.align ?? 'left';
                    const value = getValue(row, column);
                    const content = column.render
                      ? column.render(row, rowIndex)
                      : column.type === 'status'
                        ? <CommonChips status={String(value)} label={String(value).toLowerCase()} />
                        : value;

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]',
                          alignClasses[align],
                          column.className
                        )}
                      >
                        {content as React.ReactNode}
                      </td>
                    );
                  })}
                  {hasActions && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {actions
                          ?.filter((action) => !action.hidden?.(row))
                          .map((action, actionIndex) => {
                            const actionType = action.type ?? 'custom';
                            const label = action.label ?? actionType;
                            return (
                              <CommonTooltip key={`${actionType}-${actionIndex}`} content={label}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    'h-9 w-9 rounded-full p-0',
                                    actionType === 'delete' && 'text-red-600 hover:bg-red-50 hover:text-red-700',
                                    action.className
                                  )}
                                  disabled={action.disabled?.(row)}
                                  onClick={() => action.onClick(row)}
                                  aria-label={label}
                                >
                                  {action.icon ?? actionIcons[actionType]}
                                </Button>
                              </CommonTooltip>
                            );
                          })}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && resolvedTotalItems > 0 && (
        <CommonPagination
          page={currentPage}
          pageSize={currentPageSize}
          totalItems={resolvedTotalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </section>
  );
};

export default CommonTable;
export { CommonTable };
