import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div key={index} className="flex items-center">
            {item.href && !isLast ? (
              <a 
                href={item.href} 
                className="text-[16px] text-icons-outside hover:text-heading transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className={`text-[16px] ${isLast ? 'text-heading font-medium' : 'text-icons-outside'}`}>
                {item.label}
              </span>
            )}
            
            {!isLast && (
              <span className="mx-2 text-help select-none">/</span>
            )}
          </div>
        );
      })}
    </nav>
  );
};
