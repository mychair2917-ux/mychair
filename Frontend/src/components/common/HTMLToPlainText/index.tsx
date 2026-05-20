import { useEffect, useState } from 'react';

export const HtmlToPlainText = ({ html, className }: { html: string; className: string }) => {
  const [text, setText] = useState('');

  useEffect(() => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    setText(tempElement.textContent || '');
  }, [html]);

  return <div className={className}>{text}</div>;
};
