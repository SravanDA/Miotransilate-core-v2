import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className = '', children, ...props }) => {
  return (
    <div className="w-full border border-border-main rounded-[4px] overflow-hidden">
      <table className={`w-full text-left border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', children, ...props }) => {
  return (
    <thead className={`bg-table-head border-b border-border-main ${className}`} {...props}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', children, ...props }) => {
  return (
    <tbody className={`bg-white divide-y divide-border-main ${className}`} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = '', children, ...props }) => {
  return (
    <tr className={`hover:bg-table-row-even transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
};

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', children, ...props }) => {
  return (
    <th 
      className={`px-4 py-3 text-[14px] font-semibold text-table-head align-middle ${className}`} 
      {...props}
    >
      {children}
    </th>
  );
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', children, ...props }) => {
  return (
    <td 
      className={`px-4 py-3 text-[14px] text-heading align-middle ${className}`} 
      {...props}
    >
      {children}
    </td>
  );
};
