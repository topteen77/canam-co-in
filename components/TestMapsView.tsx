import React, { useEffect } from 'react';

const TestMapsView: React.FC = () => {
  // Debug log to confirm component mounting in console
  useEffect(() => {
    console.log('🧪 TestMapsView mounted successfully');
  }, []);

  return (
    <div className="p-6 h-full min-h-[50vh] bg-slate-50 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">TEST: New Maps Component</h2>
        
        <div className="bg-red-100 border-2 border-red-500 p-6 rounded-xl shadow-sm text-center">
          <div className="text-4xl mb-4">📍</div>
          <p className="text-red-800 font-bold text-lg mb-2">
            If you can see this message, the new component is working!
          </p>
          <p className="text-red-600">
            This view has successfully replaced the old grid/map component.
          </p>
          <div className="mt-4 text-xs font-mono bg-white/50 p-2 rounded text-red-800">
             Component: src/components/TestMapsView.tsx
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestMapsView;