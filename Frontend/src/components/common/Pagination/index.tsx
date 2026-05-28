import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../../utils/cn';
import Button from '../Button';
import Select from '../Select';

export interface CommonPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  siblingCount?: number;
  className?: string;
}

const buildPages = (currentPage: number, totalPages: number, siblingCount: number) => {
  const pages = new Set<number>([1, totalPages]);
  for (let page = currentPage - siblingCount; page <= currentPage + siblingCount; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
};

const CommonPagination: React.FC<CommonPaginationProps> = ({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  siblingCount = 1,
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pages = buildPages(safePage, totalPages, siblingCount);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-[var(--color-border-soft)] bg-white px-4 py-4 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div>
        Showing <span className="font-semibold text-[var(--color-text-primary)]">{startItem}</span> to{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{endItem}</span> of{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{totalItems}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <Select
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              options={pageSizeOptions.map((option) => ({
                value: String(option),
                label: String(option),
              }))}
              className="h-10 min-w-20 rounded-xl"
            />
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 w-9 p-0"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((pageNumber, index) => {
            const previousPage = pages[index - 1];
            const showGap = previousPage && pageNumber - previousPage > 1;
            return (
              <React.Fragment key={pageNumber}>
                {showGap && <span className="px-2 text-gray-400">...</span>}
                <Button
                  type="button"
                  variant={pageNumber === safePage ? 'primary' : 'ghost'}
                  size="sm"
                  className="h-9 min-w-9 px-3"
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </Button>
              </React.Fragment>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 w-9 p-0"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommonPagination;
export { CommonPagination };
