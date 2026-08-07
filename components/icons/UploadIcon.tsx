import React from 'react';

export const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}
  >
    <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V17.25c0 .621 0 1.242 0 1.863 0 .596.234 1.17.659 1.595 1.488 1.488 4.904 1.488 11.764 0 2.21-2.21 2.21-5.787 0-7.996-1.488-1.488-4.904-1.488-11.764 0-1.026 1.026-1.026 2.688 0 3.714" 
    />
</svg>
);