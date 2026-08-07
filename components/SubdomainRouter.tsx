import React, { useEffect, useState, createContext, useContext } from 'react';

// Define the shape of the company info
export interface CompanyInfo {
  companyId: string;
  companyName: string;
  isSubdomain: boolean;
}

// Define the Context type
interface CompanyContextType {
  company: CompanyInfo | null;
  isLoading: boolean;
}

// 🟢 SAFE FIX: Create Context to expose data to children
export const CompanyContext = createContext<CompanyContextType>({
  company: null,
  isLoading: true,
});

// 🟢 SAFE FIX: Custom hook for easy access in other components
export const useCompany = () => useContext(CompanyContext);

interface SubdomainRouterProps {
  children: React.ReactNode;
}

// List of domains that should NOT be treated as subdomains
const ROOT_DOMAINS = [
  'agent-follow-up-crm.web.app',
  'localhost',
  '127.0.0.1',
  'canam-crm.web.app', // Add your production domains here
  'firebaseapp.com'
];

const SubdomainRouter: React.FC<SubdomainRouterProps> = ({ children }) => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectCompany = () => {
      try {
        const hostname = window.location.hostname;
        const searchParams = new URLSearchParams(window.location.search);
        
        // 1. Check for URL parameter Override (?company=xyz)
        // This is useful for testing or explicit overrides
        const companyParam = searchParams.get('company');
        
        if (companyParam) {
          const companyId = companyParam.toLowerCase().trim();
          setCompanyInfo({
            companyId,
            companyName: companyId.charAt(0).toUpperCase() + companyId.slice(1),
            isSubdomain: false
          });
          setIsLoading(false);
          return;
        }

        // 2. Clean Hostname (remove port and www)
        const cleanHost = hostname.split(':')[0].replace(/^www\./, '');

        // 3. Check if current host is a Root Domain (no subdomain)
        const isRootDomain = ROOT_DOMAINS.some(domain => cleanHost === domain || cleanHost.endsWith(`.${domain}`));
        
        // 4. Extract Subdomain
        // If it's localhost, we look for sub.localhost
        if (cleanHost.includes('localhost')) {
            const parts = cleanHost.split('.');
            if (parts.length > 1 && parts[0] !== 'localhost') {
                const subdomain = parts[0];
                setCompanyInfo({
                    companyId: subdomain.toLowerCase(),
                    companyName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
                    isSubdomain: true
                });
                setIsLoading(false);
                return;
            }
        } 
        // If it's a production domain
        else if (!ROOT_DOMAINS.includes(cleanHost)) {
             const parts = cleanHost.split('.');
             // Basic heuristic: if parts > 2, it likely has a subdomain (e.g. tenant.app.com)
             // Note: This logic might need adjustment for co.uk domains
             if (parts.length > 2) {
                 const subdomain = parts[0];
                 // Ensure subdomain isn't just 'app' or 'www'
                 if (subdomain !== 'app' && subdomain !== 'www') {
                     setCompanyInfo({
                        companyId: subdomain.toLowerCase(),
                        companyName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
                        isSubdomain: true
                     });
                     setIsLoading(false);
                     return;
                 }
             }
        }

        // 5. No company detected
        setCompanyInfo(null);
      } catch (error) {
        console.error("Error detecting company subdomain:", error);
        setCompanyInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    detectCompany();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading environment...</p>
        </div>
      </div>
    );
  }

  // 🟢 SAFE FIX: Wrap children in Provider so they can access the data
  return (
    <CompanyContext.Provider value={{ company: companyInfo, isLoading }}>
      {children}
    </CompanyContext.Provider>
  );
};

export default SubdomainRouter;