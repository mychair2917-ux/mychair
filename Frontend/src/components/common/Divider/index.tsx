import { cn } from './../../../utils/cn';
import { DividerProps } from './Types';

const Divider = ({ text, className, textClassName, borderClassName }: DividerProps) => {
  if (!text) {
    return <hr className={cn('border-t border-gray-600', className)} />;
  }

  return (
    <div className={cn('flex w-full items-center', className)}>
      <div className={cn('flex-grow border-t border-gray-600', borderClassName)} />
      <span className={cn('px-3 text-sm whitespace-nowrap text-gray-900', textClassName)}>
        {text}
      </span>
      <div className="flex-grow border-t border-gray-600" />
    </div>
  );
};

export default Divider;
