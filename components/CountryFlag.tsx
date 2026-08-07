import React from 'react';
import { COUNTRY_CODES, COUNTRY_FLAGS } from '../types';

interface CountryFlagProps {
  country: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ country, className = '', size = 'sm' }) => {
  const normalizedCountry = (country || '').trim();
  // Try exact match, then case-insensitive match
  let code = COUNTRY_CODES[normalizedCountry];
  
  if (!code) {
    const entry = Object.entries(COUNTRY_CODES).find(
      ([key]) => key.toLowerCase() === normalizedCountry.toLowerCase()
    );
    if (entry) code = entry[1];
  }
  
  if (!code) {
    return <span className={className} title={country}>🏳️</span>;
  }

  const width = size === 'sm' ? 20 : size === 'md' ? 28 : 36;
  
  return (
    <img 
      src={`https://flagcdn.com/w${width}/${code.toLowerCase()}.png`}
      width={width}
      height="auto"
      alt={country}
      className={`inline-block align-middle rounded-[1px] shadow-sm ${className}`}
      style={{ 
        display: 'inline-block', 
        verticalAlign: 'middle', 
        marginTop: '-2px',
        maxWidth: 'none',
        height: 'auto'
      }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.onerror = null;
        // If image fails, replace with emoji fallback
        const parent = target.parentElement;
        if (parent) {
          const span = document.createElement('span');
          span.textContent = COUNTRY_FLAGS[country] || '🏳️';
          span.title = country;
          parent.replaceChild(span, target);
        }
      }}
    />
  );
};
