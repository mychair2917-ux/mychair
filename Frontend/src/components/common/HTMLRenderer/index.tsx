import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

import { HTMLRendererProps } from './Types';

/**
 * HTMLRenderer Component
 *
 * Safely renders sanitized HTML content using DOMPurify to prevent XSS attacks.
 * Optionally adds attributes to open links in new tabs securely when enabled.
 *
 * Parameters:
 * @param {HTMLRendererProps} props - Component props
 * @param {string} props.html - The raw HTML string to render
 * @param {string} [props.className] - Optional CSS class for the container div
 * @param {boolean} [props.openLinksInNewTab=false] - When true, adds target="_blank" and rel="noopener noreferrer" to all links
 *
 * Returns:
 * @returns {JSX.Element} A div element containing the sanitized HTML content
 *
 * Exception Handling:
 * None
 */
const HTMLRenderer = ({ html, className, openLinksInNewTab = false }: HTMLRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sanitizedHTML = DOMPurify.sanitize(html);

  /**
   * Manages link attributes within the component's HTML content.
   * When `openLinksInNewTab` is true, this effect ensures all links
   * open in a new tab (`target="_blank"`) and include essential
   * security and privacy attributes (`rel="noopener noreferrer"`),
   * while preserving any existing attributes on the links.
   *
   * @remarks
   * This effect re-runs when `sanitizedHTML` or `openLinksInNewTab` changes.
   */
  useEffect(() => {
    if (containerRef.current && openLinksInNewTab) {
      const links = containerRef.current.querySelectorAll('a');
      links.forEach((link) => {
        if (!link.hasAttribute('target')) {
          link.setAttribute('target', '_blank');
        }
        if (!link.hasAttribute('rel')) {
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }
  }, [sanitizedHTML, openLinksInNewTab]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
};

export default HTMLRenderer;
