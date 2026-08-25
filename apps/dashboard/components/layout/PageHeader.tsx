import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { BreadcrumbTrail, BreadcrumbItem } from '../ui/BreadcrumbTrail';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({ className, title, description, breadcrumbs, children, ...props }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8", className)} {...props}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && <BreadcrumbTrail items={breadcrumbs} />}
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
