import { cn } from '../../../utils/cn';
import { SearchMinusIcon } from '../../Icons';

interface Props {
  content?: string;
  title?: string;
  className?: string;
  mainDivStyle?: string;
}

/**
  TableNoDataFound Component
 
  Displays a friendly "No Data Available" message with an icon and placeholder rows
  for empty table states. Useful in data tables when no records are present.
 
  @component
 
  @param {Object} props - Props for the TableNoDataFound component.
  @param {string} [props.content] - Optional message to display under the title.
  @param {string} [props.title='No Data Available'] - Optional title to display.
  @param {string} [props.className] - Additional CSS classes for custom styling.
 
  @returns {JSX.Element} A styled placeholder view indicating empty data state.
 
  @example
  <TableNoDataFound
    title="No Projects Found"
    content="Try changing your filters or create a new project."
  />
 */

const TableNoDataFound = ({
  content = '',
  title = 'No Data Available',
  className,
  mainDivStyle,
}: Props) => {
  return (
    <div className={cn('flex h-full w-full flex-1 overflow-hidden rounded-md', mainDivStyle)}>
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center bg-white px-4 py-16',
          className
        )}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <SearchMinusIcon color="charcoal" />
        </div>
        <h4 className="mb-1 font-medium text-gray-700">{title}</h4>
        <p className="mb-4 max-w-sm text-center text-sm text-gray-500">{content}</p>
        <div className="mb-6 w-64 max-w-full opacity-50">
          <div className="flex border-b border-gray-200 py-2">
            <div className="mr-2 h-2 w-1/3 rounded bg-gray-200"></div>
            <div className="mr-2 h-2 w-1/3 rounded bg-gray-200"></div>
            <div className="h-2 w-1/3 rounded bg-gray-200"></div>
          </div>
          <div className="flex border-b border-gray-200 py-2">
            <div className="mr-2 h-2 w-1/3 rounded bg-gray-100"></div>
            <div className="mr-2 h-2 w-1/4 rounded bg-gray-100"></div>
            <div className="h-2 w-1/4 rounded bg-gray-100"></div>
          </div>
          <div className="flex py-2">
            <div className="mr-2 h-2 w-1/3 rounded bg-gray-100"></div>
            <div className="mr-2 h-2 w-1/4 rounded bg-gray-100"></div>
            <div className="h-2 w-1/4 rounded bg-gray-100"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableNoDataFound;
