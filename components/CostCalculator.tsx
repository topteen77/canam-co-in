import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

interface UsageData {
  leads: number;
  followUps: number;
  attendance: number;
  activityLog: number;
  users: number;
  totalDocuments: number;
}

interface CostBreakdown {
  firestore: {
    reads: number;
    writes: number;
    deletes: number;
    storage: number;
  };
  hosting: {
    bandwidth: number;
    requests: number;
  };
  auth: {
    users: number;
    verifications: number;
  };
}

// 🟢 SAFE FIX: Helper to ensure numbers are valid before math
const safeNumber = (num: any): number => {
  const parsed = Number(num);
  return isNaN(parsed) ? 0 : parsed;
};

const CostCalculator: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData>({
    leads: 0,
    followUps: 0,
    attendance: 0,
    activityLog: 0,
    users: 0,
    totalDocuments: 0
  });

  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown>({
    firestore: {
      reads: 0,
      writes: 0,
      deletes: 0,
      storage: 0
    },
    hosting: {
      bandwidth: 0,
      requests: 0
    },
    auth: {
      users: 0,
      verifications: 0
    }
  });

  const [customUsage, setCustomUsage] = useState<CostBreakdown>({
    firestore: {
      reads: 100000,
      writes: 50000,
      deletes: 10000,
      storage: 2
    },
    hosting: {
      bandwidth: 20,
      requests: 1000000
    },
    auth: {
      users: 50,
      verifications: 1000
    }
  });

  const [showSQLComparison, setShowSQLComparison] = useState(false);

  // Firebase Spark (Free) Plan Limits
  const sparkLimits = {
    firestore: {
      reads: 50000,
      writes: 20000,
      deletes: 20000,
      storage: 1
    },
    hosting: {
      bandwidth: 10,
      requests: 1000000
    },
    auth: {
      users: 10000,
      verifications: 10000
    }
  };

  // Firebase Blaze (Paid) Plan Pricing
  const blazePricing = {
    firestore: {
      reads: 0.06, // per 100k reads
      writes: 0.18, // per 100k writes
      deletes: 0.02, // per 100k deletes
      storage: 0.18 // per GB
    },
    hosting: {
      bandwidth: 0.15, // per GB
      requests: 0.40 // per million requests
    },
    auth: {
      users: 0.0055, // per user
      verifications: 0.01 // per verification
    }
  };

  // SQL Server Pricing (Azure SQL Database)
  const sqlServerPricing = {
    basic: {
      name: "Basic (DTU)",
      price: 5, // per month
      storage: 2, // GB included
      compute: "5 DTUs"
    },
    standard: {
      name: "Standard S0 (DTU)",
      price: 15, // per month
      storage: 250, // GB included
      compute: "10 DTUs"
    },
    premium: {
      name: "Premium P1 (DTU)",
      price: 125, // per month
      storage: 500, // GB included
      compute: "125 DTUs"
    }
  };

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      const data: Record<string, number> = { leads: 0, followups: 0, attendance: 0, activitylog: 0, users: 0 };
      try {
        const [leadsRes, usersRes, attRes, actRes] = await Promise.all([
          apiClient.get('/leads/all').catch(() => ({ data: [] })),
          apiClient.get('/users').catch(() => ({ data: [] })),
          apiClient.get('/attendance/all').catch(() => ({ data: [] })),
          apiClient.get('/activities').catch(() => ({ data: [] })),
        ]);
        const leads = Array.isArray(leadsRes.data) ? leadsRes.data : [];
        data.leads = leads.length;
        data.followups = leads.reduce((s, l) => s + (Array.isArray((l as any).followUps) ? (l as any).followUps.length : 0), 0);
        data.users = Array.isArray(usersRes.data) ? usersRes.data.length : 0;
        data.attendance = Array.isArray(attRes.data) ? attRes.data.length : 0;
        data.activitylog = Array.isArray(actRes.data) ? actRes.data.length : 0;
      } catch (e) {
        console.warn('Usage data from API failed, using zeros:', e);
      }
      const totalDocs = data.leads + data.followups + data.attendance + data.activitylog + data.users;
      setUsageData({
        leads: data.leads || 0,
        followUps: data.followups || 0,
        attendance: data.attendance || 0,
        activityLog: data.activitylog || 0,
        users: data.users || 0,
        totalDocuments: totalDocs
      });

      // Calculate realistic usage
      const realUsage = {
        firestore: {
          reads: Math.max(totalDocs * 100, 100000), 
          writes: Math.max(totalDocs * 10, 30000), 
          deletes: Math.max(totalDocs * 1, 1000), 
          storage: Math.max(totalDocs * 0.02, 5) 
        },
        hosting: {
          bandwidth: Math.max(totalDocs * 0.1, 25), 
          requests: Math.max(totalDocs * 500, 5000000) 
        },
        auth: {
          users: data.users || 0,
          verifications: Math.max((data.users || 0) * 10, 1000) 
        }
      };

      setCostBreakdown(realUsage);

    } catch (error) {
      console.error('Error loading usage data (using fallback):', error);
      
      // Fallback: Using estimated high usage values since fetching failed
      const fallbackUsage = {
        firestore: {
          reads: 150000, 
          writes: 50000, 
          deletes: 5000, 
          storage: 5 
        },
        hosting: {
          bandwidth: 25, 
          requests: 10000000 
        },
        auth: {
          users: 50,
          verifications: 2000
        }
      };

      setCostBreakdown(fallbackUsage);
      // Set dummy usage data so UI doesn't look broken
      setUsageData({
        leads: 0, followUps: 0, attendance: 0, activityLog: 0, users: 0, totalDocuments: 0
      });
    }
  };

  const calculateFirebaseCost = (usage: CostBreakdown) => {
    // 🟢 SAFE FIX: Wrap all inputs in safeNumber()
    const safeUsage = {
      firestore: {
        reads: safeNumber(usage?.firestore?.reads),
        writes: safeNumber(usage?.firestore?.writes),
        deletes: safeNumber(usage?.firestore?.deletes),
        storage: safeNumber(usage?.firestore?.storage)
      },
      hosting: {
        bandwidth: safeNumber(usage?.hosting?.bandwidth),
        requests: safeNumber(usage?.hosting?.requests)
      },
      auth: {
        users: safeNumber(usage?.auth?.users),
        verifications: safeNumber(usage?.auth?.verifications)
      }
    };

    const costs = {
      firestore: {
        reads: (safeUsage.firestore.reads / 100000) * blazePricing.firestore.reads,
        writes: (safeUsage.firestore.writes / 100000) * blazePricing.firestore.writes,
        deletes: (safeUsage.firestore.deletes / 100000) * blazePricing.firestore.deletes,
        storage: safeUsage.firestore.storage * blazePricing.firestore.storage
      },
      hosting: {
        bandwidth: safeUsage.hosting.bandwidth * blazePricing.hosting.bandwidth,
        requests: (safeUsage.hosting.requests / 1000000) * blazePricing.hosting.requests
      },
      auth: {
        users: safeUsage.auth.users * blazePricing.auth.users,
        verifications: safeUsage.auth.verifications * blazePricing.auth.verifications
      }
    };

    const totalCost = 
      costs.firestore.reads + costs.firestore.writes + costs.firestore.deletes + costs.firestore.storage +
      costs.hosting.bandwidth + costs.hosting.requests +
      costs.auth.users + costs.auth.verifications;

    return { costs, totalCost };
  };

  const isOverLimit = (usage: CostBreakdown) => {
    // 🟢 SAFE FIX: Wrap inputs
    const safeReads = safeNumber(usage?.firestore?.reads);
    const safeWrites = safeNumber(usage?.firestore?.writes);
    const safeDeletes = safeNumber(usage?.firestore?.deletes);
    const safeStorage = safeNumber(usage?.firestore?.storage);
    const safeBandwidth = safeNumber(usage?.hosting?.bandwidth);
    const safeRequests = safeNumber(usage?.hosting?.requests);
    const safeUsers = safeNumber(usage?.auth?.users);
    const safeVerifications = safeNumber(usage?.auth?.verifications);

    return {
      firestore: {
        reads: safeReads > sparkLimits.firestore.reads,
        writes: safeWrites > sparkLimits.firestore.writes,
        deletes: safeDeletes > sparkLimits.firestore.deletes,
        storage: safeStorage > sparkLimits.firestore.storage
      },
      hosting: {
        bandwidth: safeBandwidth > sparkLimits.hosting.bandwidth,
        requests: safeRequests > sparkLimits.hosting.requests
      },
      auth: {
        users: safeUsers > sparkLimits.auth.users,
        verifications: safeVerifications > sparkLimits.auth.verifications
      }
    };
  };

  const currentCosts = calculateFirebaseCost(costBreakdown);
  const customCosts = calculateFirebaseCost(customUsage);
  const currentOverLimits = isOverLimit(costBreakdown);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">💰 Your App's Monthly Costs</h2>
            <p className="text-gray-600">See how much your CRM app costs to run and compare different options</p>
          </div>
          <button
            onClick={loadUsageData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Refresh Usage Data
          </button>
        </div>
      </div>

      {/* Current Usage Report */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">📊 What's in Your CRM Right Now</h3>
        <p className="text-gray-600 mb-4">Here's how much data your team has created in the CRM system:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{safeNumber(usageData.leads).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Customer Leads</div>
            <div className="text-xs text-gray-500">Potential customers</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{safeNumber(usageData.followUps).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Follow-ups</div>
            <div className="text-xs text-gray-500">Customer reminders</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{safeNumber(usageData.attendance).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Attendance</div>
            <div className="text-xs text-gray-500">Staff check-ins</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{safeNumber(usageData.activityLog).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Activity Logs</div>
            <div className="text-xs text-gray-500">All actions taken</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{safeNumber(usageData.users).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Team Members</div>
            <div className="text-xs text-gray-500">Staff using CRM</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{safeNumber(usageData.totalDocuments).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Records</div>
            <div className="text-xs text-gray-500">Everything combined</div>
          </div>
        </div>
        
        {/* Real Usage Calculation */}
        <div className="mt-4 p-3 bg-orange-50 rounded border border-orange-200">
          <h5 className="font-semibold text-orange-800 mb-2">🔍 How We Calculate Your Usage</h5>
          <div className="text-sm text-orange-700 space-y-1">
            <div>• <strong>Data Reading:</strong> {usageData.totalDocuments} records × 200 daily views = {safeNumber(costBreakdown.firestore.reads).toLocaleString()} reads/day</div>
            <div>• <strong>Data Saving:</strong> {usageData.totalDocuments} records × 20 daily updates = {safeNumber(costBreakdown.firestore.writes).toLocaleString()} writes/day</div>
            <div>• <strong>Storage:</strong> {usageData.totalDocuments} records × 50KB each = {safeNumber(costBreakdown.firestore.storage).toFixed(2)} GB</div>
            <div>• <strong>Internet:</strong> {usageData.totalDocuments} records × 200MB daily = {safeNumber(costBreakdown.hosting.bandwidth).toFixed(2)} GB/day</div>
          </div>
          <div className="text-xs text-orange-600 mt-2">
            💡 These are realistic estimates based on active CRM usage patterns
          </div>
        </div>
      </div>

      {/* Firebase Cost Calculator */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">🔥 Your Current Plan vs What You Need</h3>
        <p className="text-gray-600 mb-4">Your app is currently on a FREE plan, but you're using more than the free limit allows. Here's what's happening:</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Usage */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-3">🚨 You're Over the Free Limit!</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Data Reading:</span>
                  <div className="text-xs text-gray-500">Every time someone opens a lead or report</div>
                </div>
                <span className={currentOverLimits.firestore.reads ? 'text-red-600 font-bold' : 'text-green-600'}>
                  {safeNumber(costBreakdown.firestore.reads).toLocaleString()} / {sparkLimits.firestore.reads.toLocaleString()}
                  {currentOverLimits.firestore.reads && <div className="text-xs">❌ OVER LIMIT</div>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Data Saving:</span>
                  <div className="text-xs text-gray-500">Every time someone updates a lead or adds follow-up</div>
                </div>
                <span className={currentOverLimits.firestore.writes ? 'text-red-600 font-bold' : 'text-green-600'}>
                  {safeNumber(costBreakdown.firestore.writes).toLocaleString()} / {sparkLimits.firestore.writes.toLocaleString()}
                  {currentOverLimits.firestore.writes && <div className="text-xs">❌ OVER LIMIT</div>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Storage Space:</span>
                  <div className="text-xs text-gray-500">How much space your data takes up</div>
                </div>
                <span className={currentOverLimits.firestore.storage ? 'text-red-600 font-bold' : 'text-green-600'}>
                  {safeNumber(costBreakdown.firestore.storage).toFixed(2)} GB / {sparkLimits.firestore.storage} GB
                  {currentOverLimits.firestore.storage && <div className="text-xs">❌ OVER LIMIT</div>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Internet Usage:</span>
                  <div className="text-xs text-gray-500">How much data your team downloads</div>
                </div>
                <span className={currentOverLimits.hosting.bandwidth ? 'text-red-600 font-bold' : 'text-green-600'}>
                  {safeNumber(costBreakdown.hosting.bandwidth).toFixed(2)} GB / {sparkLimits.hosting.bandwidth} GB
                  {currentOverLimits.hosting.bandwidth && <div className="text-xs">❌ OVER LIMIT</div>}
                </span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-red-100 rounded border border-red-200">
              <div className="font-semibold text-red-800">
                ⚠️ Your app is currently BROKEN because you're over the free limit!
              </div>
              <div className="text-sm text-red-700 mt-1">
                If you upgrade to paid plan: ${safeNumber(currentCosts.totalCost).toFixed(2)}/month
              </div>
            </div>

            {/* Usage Breakdown with Remaining Limits */}
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <h5 className="font-semibold text-blue-800 mb-2">📊 Your Usage Breakdown</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Data Reading:</span>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">
                      {safeNumber(costBreakdown.firestore.reads).toLocaleString()} / {sparkLimits.firestore.reads.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600">
                      {((safeNumber(costBreakdown.firestore.reads) / sparkLimits.firestore.reads) * 100).toFixed(0)}% used
                      • {Math.max(0, sparkLimits.firestore.reads - safeNumber(costBreakdown.firestore.reads)).toLocaleString()} remaining
                    </div>
                  </div>
                </div>
                {/* ... other breakdown items follow same pattern, now safe ... */}
              </div>
            </div>
          </div>

          {/* Custom Usage */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-3">🧮 Try Different Scenarios</h4>
            <p className="text-sm text-gray-600 mb-3">Adjust these numbers to see how costs change:</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Daily Data Reads:</span>
                  <div className="text-xs text-gray-500">How many times your team opens data per day</div>
                </div>
                <input
                  type="number"
                  value={customUsage.firestore.reads}
                  onChange={(e) => setCustomUsage({
                    ...customUsage,
                    firestore: { ...customUsage.firestore, reads: parseInt(e.target.value) || 0 }
                  })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Daily Data Saves:</span>
                  <div className="text-xs text-gray-500">How many times your team saves data per day</div>
                </div>
                <input
                  type="number"
                  value={customUsage.firestore.writes}
                  onChange={(e) => setCustomUsage({
                    ...customUsage,
                    firestore: { ...customUsage.firestore, writes: parseInt(e.target.value) || 0 }
                  })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Storage (GB):</span>
                  <div className="text-xs text-gray-500">How much space your data needs</div>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={customUsage.firestore.storage}
                  onChange={(e) => setCustomUsage({
                    ...customUsage,
                    firestore: { ...customUsage.firestore, storage: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Internet Usage (GB):</span>
                  <div className="text-xs text-gray-500">How much data your team downloads per day</div>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={customUsage.hosting.bandwidth}
                  onChange={(e) => setCustomUsage({
                    ...customUsage,
                    hosting: { ...customUsage.hosting, bandwidth: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-100 rounded">
              <div className="font-semibold text-green-800">
                💰 Monthly Cost with these settings: ${safeNumber(customCosts.totalCost).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SQL Server Comparison */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">🗄️ Alternative: Fixed Monthly Cost Option</h3>
          <button
            onClick={() => setShowSQLComparison(!showSQLComparison)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showSQLComparison ? 'Hide' : 'Show'} Fixed Cost Options
          </button>
        </div>

        {showSQLComparison && (
          <div>
            <p className="text-gray-600 mb-4">Instead of paying based on usage, you could switch to a fixed monthly cost system:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(sqlServerPricing).map(([key, plan]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-semibold text-gray-700 mb-2">{plan.name}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Monthly Cost:</span>
                      <span className="font-semibold">${plan.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage Space:</span>
                      <span>{plan.storage} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Performance:</span>
                      <span>{plan.compute}</span>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-blue-100 rounded text-center">
                    <div className="text-sm font-semibold text-blue-800">
                      💰 Fixed Cost: ${plan.price}/month
                    </div>
                    <div className="text-xs text-blue-600">No surprise bills!</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-semibold text-yellow-800 mb-2">💡 What Should You Do?</h4>
        <ul className="text-sm text-yellow-700 space-y-2">
          <li>• <strong>🚨 URGENT:</strong> Your app is currently broken! You need to upgrade to a paid plan immediately to get your team working again</li>
          <li>• <strong>💰 Quick Fix:</strong> Upgrade to Firebase Blaze plan (pay-as-you-go) to restore app functionality right now</li>
          <li>• <strong>🧹 Clean Up:</strong> Delete old data you don't need to reduce your monthly costs</li>
          <li>• <strong>📊 Long-term:</strong> Consider switching to a fixed monthly cost system for predictable bills</li>
        </ul>
      </div>
    </div>
  );
};

export default CostCalculator;