// components/CompanyBranding.tsx
import React from 'react';

interface CompanyBrandingProps {
  companyId: string;
  companyName: string;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

const CompanyBranding: React.FC<CompanyBrandingProps> = ({
  companyId,
  companyName,
  size = 'medium',
  showText = true,
  className = ''
}) => {
  // 🟢 SAFE FIX: Normalize ID to prevent mismatch due to case/whitespace
  const normalizedId = (companyId || '').toLowerCase().trim();
  
  // 🟢 SAFE FIX: Strict size validation - default to 'medium' if invalid
  const safeSize = ['small', 'medium', 'large'].includes(size) ? size : 'medium';

  // Company-specific branding configurations
  const companyBrands: { [key: string]: any } = {
    'iapply': {
      logo: (size: string) => {
        const sizeClasses = {
          small: { icon: 'w-6 h-7', text: 'text-sm', margin: 'mr-2' },
          medium: { icon: 'w-8 h-10', text: 'text-lg', margin: 'mr-3' },
          large: { icon: 'w-12 h-14', text: 'text-2xl', margin: 'mr-4' }
        };
        // 🟢 SAFE FIX: Access property safely
        const currentSize = sizeClasses[safeSize as keyof typeof sizeClasses] || sizeClasses.medium;
        
        return (
          <div className="flex items-center">
            {/* iApply Logo - Green stacked documents */}
            <div className={`relative ${currentSize.margin}`}>
              <div className={`${currentSize.icon} bg-green-500 rounded-sm transform rotate-3 shadow-sm`}></div>
              <div className={`${currentSize.icon} bg-green-400 rounded-sm transform rotate-1 absolute top-0 left-0 shadow-sm`}></div>
              <div className={`${currentSize.icon} bg-green-300 rounded-sm transform -rotate-1 absolute top-0 left-0 shadow-sm`}></div>
            </div>
            {showText && (
              <span className={`text-white font-semibold ${currentSize.text}`}>iapply</span>
            )}
          </div>
        );
      },
      primaryColor: 'bg-green-600',
      secondaryColor: 'bg-green-100',
      textColor: 'text-green-600',
      accentColor: 'border-green-500'
    },
    'canam': {
      logo: (size: string) => {
        const sizeClasses = {
          small: { icon: 'w-6 h-6', text: 'text-sm', margin: 'mr-2' },
          medium: { icon: 'w-8 h-8', text: 'text-lg', margin: 'mr-3' },
          large: { icon: 'w-12 h-12', text: 'text-2xl', margin: 'mr-4' }
        };
        // 🟢 SAFE FIX: Access property safely
        const currentSize = sizeClasses[safeSize as keyof typeof sizeClasses] || sizeClasses.medium;
        
        return (
          <div className="flex items-center">
            {/* Canam Logo - Blue circle with C */}
            <div className={`${currentSize.icon} bg-blue-600 rounded-full flex items-center justify-center ${currentSize.margin}`}>
              <span className={`text-white font-bold ${currentSize.text}`}>C</span>
            </div>
            {showText && (
              <span className={`text-white font-semibold ${currentSize.text}`}>Canam CRM</span>
            )}
          </div>
        );
      },
      primaryColor: 'bg-blue-600',
      secondaryColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      accentColor: 'border-blue-500'
    }
  };

  // 🟢 SAFE FIX: Robust fallback logic
  const brand = companyBrands[normalizedId] || companyBrands['canam'];

  // Debug logging
  console.log('🎨 CompanyBranding Debug:', {
    inputCompanyId: companyId,
    normalizedId,
    resolvedBrand: normalizedId === 'iapply' ? 'iApply' : 'Canam (Default)',
    size: safeSize
  });

  const textSizeClass = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl'
  }[safeSize] || 'text-lg';

  return (
    <div className={`flex items-center ${textSizeClass} ${className}`}>
      {typeof brand.logo === 'function' ? brand.logo(safeSize) : null}
    </div>
  );
};

export default CompanyBranding;