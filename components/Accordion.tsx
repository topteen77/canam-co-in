// This component is no longer used in the new application design.
// Its functionality has been replaced by simpler layouts within the modal components.
// Keeping the file to satisfy the project structure constraints, but it can be considered deprecated.

import React from 'react';

export const Accordion: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return <div className="space-y-2">{children}</div>;
};

export const AccordionItem: React.FC<{children: React.ReactNode; title: string; defaultOpen?: boolean;}> = ({ children, title, defaultOpen }) => {
  return (
    <details className="bg-slate-50 p-3 rounded-md" open={defaultOpen}>
        <summary className="font-medium cursor-pointer">{title}</summary>
        <div className="pt-2">{children}</div>
    </details>
  );
};