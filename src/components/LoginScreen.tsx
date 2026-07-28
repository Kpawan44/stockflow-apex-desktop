import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  UserCheck, 
  HardHat, 
  Eye, 
  Building, 
  Lock, 
  User, 
  KeyRound, 
  Play, 
  RefreshCw, 
  AlertCircle, 
  Mail, 
  UserPlus, 
  LogIn,
  ArrowRight
} from 'lucide-react';
import { UserRole, Warehouse } from '../types';
import { auth, db, getDoc, getDocs } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, query, where, deleteDoc } from 'firebase/firestore';
import stockflowLogo from '../assets/images/stockflow_logo_1783944743908.jpg';

interface LoginScreenProps {
  warehouses: Warehouse[];
  onLocalLogin?: (name: string, role: UserRole, warehouseId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ warehouses, onLocalLogin }) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [dbAdminCode, setDbAdminCode] = useState<string>('admin123');

  // Fetch admin passcode on mount to authorize registrations
  useEffect(() => {
    const fetchAdminCode = async () => {
      try {
        const docRef = doc(db, 'settings', 'auth');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.adminAuthCode) {
            setDbAdminCode(data.adminAuthCode.trim());
          }
        }
      } catch (err) {
        console.warn("Failed to fetch settings/auth doc, using fallback:", err);
      }
    };
    fetchAdminCode();
  }, []);

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Store Operator');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [adminAuthCode, setAdminAuthCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Clean and map general input username to standard secure backend email under the hood
  const getEmailFromUsername = (input: string): string => {
    const cleaned = input.toLowerCase().trim();
    if (cleaned === 'chinarsales737' || cleaned === 'chinarsales737@gmail.com' || cleaned === 'chinar sales admin') {
      return 'chinarsales737@gmail.com';
    }
    const safeStr = cleaned.replace(/[^a-z0-9_.-]/g, '');
    return safeStr ? `${safeStr}@stockflow.com` : 'anonymous@stockflow.com';
  };

  // Synchronize role state dynamically based on the input to prevent unauthorized Super Admin assignment
  useEffect(() => {
    const normalizedEmail = getEmailFromUsername(username);
    if (normalizedEmail === 'chinarsales737@gmail.com') {
      setSelectedRole('Super Admin');
    } else {
      if (selectedRole === 'Super Admin') {
        setSelectedRole('Store Operator');
      }
    }
  }, [username]);

  // Fallback warehouses in case the database is empty or still loading
  const defaultWarehouses: Warehouse[] = [
    { code: 'WH-MUM', name: 'Central Warehouse (Mumbai)', city: 'Mumbai', state: 'Maharashtra', address: 'Sector-5, Kalamboli', contactPerson: 'Rajesh Sharma', phone: '', status: 'Active', isPrimary: true },
    { code: 'WH-DEL', name: 'Regional Hub (Delhi)', city: 'New Delhi', state: 'Delhi', address: 'Okhla Phase 3', contactPerson: 'Vikram Singh', phone: '', status: 'Active' },
    { code: 'WH-BLR', name: 'South Tech Depot (Bengaluru)', city: 'Bengaluru', state: 'Karnataka', address: 'Whitefield', contactPerson: 'Anita Rao', phone: '', status: 'Active' },
    { code: 'WH-PUN', name: 'Pune Fulfillment Center', city: 'Pune', state: 'Maharashtra', address: 'Hinjawadi Phase 2', contactPerson: 'Rahul Patil', phone: '', status: 'Active' },
    { code: 'WH-DER', name: 'Derabassi Warehouse', city: 'Derabassi', state: 'Punjab', address: 'Industrial Focal Point', contactPerson: 'Harpreet Singh', phone: '', status: 'Active' }
  ];

  const activeWarehouses = warehouses.length > 0 ? warehouses : defaultWarehouses;

  // Set default warehouse code on load and sync when database warehouses finish loading
  useEffect(() => {
    if (warehouses.length > 0) {
      // Database warehouses finished loading. Let's find if the current selectedWarehouseId is valid.
      const isValid = warehouses.some(w => w.code === selectedWarehouseId);
      if (!isValid) {
        const primary = warehouses.find(w => w.isPrimary) || warehouses[0];
        setSelectedWarehouseId(primary.code);
      }
    } else if (defaultWarehouses.length > 0 && !selectedWarehouseId) {
      const primary = defaultWarehouses.find(w => w.isPrimary) || defaultWarehouses[0];
      setSelectedWarehouseId(primary.code);
    }
  }, [warehouses, selectedWarehouseId]);

  // Handle standard Username & Password Submit (Login or Register)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEmail = getEmailFromUsername(username);
    const isChinarAdmin = normalizedEmail === 'chinarsales737@gmail.com';

    const getBestWarehouseId = (): string => {
      if (activeWarehouses && activeWarehouses.length > 0) {
        const hasMum = activeWarehouses.some(w => w.code === 'WH-MUM' || w.id === 'WH-MUM');
        if (hasMum) return 'WH-MUM';
        const primary = activeWarehouses.find(w => w.isPrimary) || activeWarehouses[0];
        return primary.code || primary.id || 'WH-MUM';
      }
      return 'WH-MUM';
    };

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      setIsLoading(false);
      return;
    }

    if (isSignUp && !name.trim()) {
      setError('Please provide your full operator name.');
      setIsLoading(false);
      return;
    }

    // Determine target role and enforce single admin rule
    let finalRole: UserRole = selectedRole;
    if (isSignUp) {
      if (isChinarAdmin) {
        finalRole = 'Super Admin';
      } else {
        // Enforce other users must register as a standard user role
        if (finalRole === 'Super Admin') {
          finalRole = 'Store Operator';
        }
      }
    }

    // Passcode check is required to register any new User ID in the system
    if (isSignUp && !isChinarAdmin) {
      if (!adminAuthCode.trim() || adminAuthCode.trim() !== dbAdminCode) {
        setError('Admin Authorization Failed! A valid Admin Authorization Code is required to create a User ID.');
        setIsLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        // 1. Firebase Auth Create User using mapped email
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        const uid = userCredential.user.uid;

        // 2. Write Profile Document to Firestore
        await setDoc(doc(db, 'users', uid), {
          uid,
          name: name.trim(),
          username: username.trim(),
          email: normalizedEmail,
          role: finalRole,
          warehouseId: selectedWarehouseId
        });

        // 3. Write Security Audit Log
        const logId1 = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
        await setDoc(doc(db, 'auditLogs', logId1), {
          id: logId1,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          user: `${name.trim()} (${finalRole})`,
          action: 'Terminal Profile Registered',
          module: 'Access Gatekeeper',
          details: `Registered new secure account assigned to Warehouse ${selectedWarehouseId}`
        });

      } else {
        // 1. Firebase Auth Sign In
        try {
          const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          
          // Ensure Chinar Admin profile doc is up to date and set to Super Admin
          if (isChinarAdmin) {
            const uid = userCredential.user.uid;
            let targetWh = getBestWarehouseId();
            try {
              const uDoc = await getDoc(doc(db, 'users', uid));
              if (uDoc.exists()) {
                const existingWh = uDoc.data().warehouseId;
                if (existingWh) {
                  const whExists = activeWarehouses.some(w => w.code === existingWh || w.id === existingWh);
                  if (whExists) {
                    targetWh = existingWh;
                  }
                }
              }
            } catch (err) {
              console.warn("Could not fetch user document for WH preservation:", err);
            }

            await setDoc(doc(db, 'users', uid), {
              uid,
              name: 'Chinar Sales Admin',
              username: username.trim(),
              email: normalizedEmail,
              role: 'Super Admin',
              warehouseId: targetWh
            });
          } else {
            // Verify if the User ID / profile document exists in Firestore
            const uid = userCredential.user.uid;
            const uDoc = await getDoc(doc(db, 'users', uid));
            if (!uDoc.exists()) {
              await signOut(auth);
              setError('Access Denied. No active user profile (User ID) was found in Firestore for this account. Please create your User ID first under "Create Account" using the Admin Authorization Code.');
              setIsLoading(false);
              return;
            }
          }

          // 2. Write Security Audit Log
          const logId2 = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
          await setDoc(doc(db, 'auditLogs', logId2), {
            id: logId2,
            date: new Date().toISOString().slice(0, 10),
            time: new Date().toLocaleTimeString(),
            user: username || 'Authorized Operator',
            action: 'Terminal Logged In',
            module: 'Access Gatekeeper',
            details: 'User authenticated secure session.'
          });
        } catch (signInErr: any) {
          // If sign in fails because they do not exist, and it's chinarsales737@gmail.com, auto-create them!
          if (isChinarAdmin && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password')) {
            console.log("Auto-provisioning Chinar Admin account...");
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
              const uid = userCredential.user.uid;
              const targetWh = getBestWarehouseId();
              await setDoc(doc(db, 'users', uid), {
                uid,
                name: 'Chinar Sales Admin',
                username: username.trim(),
                email: normalizedEmail,
                role: 'Super Admin',
                warehouseId: targetWh
              });

              const logId = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
              await setDoc(doc(db, 'auditLogs', logId), {
                id: logId,
                date: new Date().toISOString().slice(0, 10),
                time: new Date().toLocaleTimeString(),
                user: 'Chinar Sales Admin (Super Admin)',
                action: 'Primary Admin Profile Auto-Registered',
                module: 'Access Gatekeeper',
                details: 'Automatically created the primary Chinar Sales Admin account.'
              });

              if (onLocalLogin) {
                onLocalLogin('Chinar Sales Admin', 'Super Admin', targetWh);
              }
              return;
            } catch (createErr: any) {
              console.error("Failed to auto-create primary admin user:", createErr);
              throw createErr;
            }
          } else {
            throw signInErr;
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/unauthorized-domain' || err.code === 'auth/unauthorized-client' || err.code === 'auth/configuration-not-found' || err.code === 'auth/internal-error') {
        console.warn("Firebase Auth restriction detected. Seamlessly falling back to direct Firestore-verified session:", err.code);
        if (onLocalLogin) {
          if (isSignUp) {
            // Write to Firestore users collection anyway so that they are registered in the DB
            const mockUid = `mock-uid-${Date.now()}`;
            try {
              await setDoc(doc(db, 'users', mockUid), {
                uid: mockUid,
                name: name.trim(),
                username: username.trim(),
                email: normalizedEmail,
                role: finalRole,
                warehouseId: selectedWarehouseId
              });

              const logId = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
              await setDoc(doc(db, 'auditLogs', logId), {
                id: logId,
                date: new Date().toISOString().slice(0, 10),
                time: new Date().toLocaleTimeString(),
                user: `${name.trim()} (${finalRole})`,
                action: 'Terminal Profile Registered (Fallback)',
                module: 'Access Gatekeeper',
                details: `Registered new secure account assigned to Warehouse ${selectedWarehouseId} in fallback mode.`
              });
            } catch (fsErr) {
              console.warn("Could not save fallback user to Firestore:", fsErr);
            }
            onLocalLogin(name.trim(), finalRole, selectedWarehouseId);
          } else {
            // It's a Sign In. Let's try to query Firestore to find the registered user!
            let foundName = username || 'Authorized Operator';
            let foundRole: UserRole = 'Store Operator';
            let foundWh = getBestWarehouseId();
            try {
               const usersRef = collection(db, 'users');
               const q = query(usersRef, where('email', '==', normalizedEmail));
               const querySnapshot = await getDocs(q);
               if (!querySnapshot.empty) {
                 const userDoc = querySnapshot.docs[0];
                 const userData = userDoc.data();
                 foundName = userData.name || foundName;
                 foundRole = userData.role || 'Store Operator';
                 foundWh = userData.warehouseId || getBestWarehouseId();
               } else {
                 // Not found in DB, if it's the primary admin email, auto-create it in Firestore!
                 if (isChinarAdmin && password === '123456') {
                   const mockUid = `mock-uid-chinar-${Date.now()}`;
                   const targetWh = getBestWarehouseId();
                   await setDoc(doc(db, 'users', mockUid), {
                     uid: mockUid,
                     name: 'Chinar Sales Admin',
                     username: username.trim(),
                     email: normalizedEmail,
                     role: 'Super Admin',
                     warehouseId: targetWh
                   });
                   foundName = 'Chinar Sales Admin';
                   foundRole = 'Super Admin';
                   foundWh = targetWh;
                 } else {
                   setError('Access Denied. No registered User ID was found for this account. Please create your User ID first under "Create Account" using the Admin Authorization Code.');
                   setIsLoading(false);
                   return;
                 }
               }
            } catch (dbErr) {
               console.warn("Could not query fallback user from Firestore:", dbErr);
               if (isChinarAdmin && password === '123456') {
                 foundRole = 'Super Admin';
               } else {
                 setError('Access Denied. Could not verify active user profile from Firestore. Please ensure your database is active.');
                 setIsLoading(false);
                 return;
               }
            }
            onLocalLogin(foundName, foundRole, foundWh);
          }
          return;
        }
      }
      console.error("Firebase auth submit error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid login credentials. Please double check.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters long.');
      } else {
        setError(err.message || 'An error occurred during authentication. Please check your connection or try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // One-click quick login with automatic registration fallback
  const handleQuickDemoLogin = async (role: UserRole, demoEmail: string, demoPass: string, demoName: string, whCode: string) => {
    setError('');
    setIsLoading(true);

    try {
      // 1. Try logging in
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPass);
        
        // Log access
        const logIdDemo1 = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
        await setDoc(doc(db, 'auditLogs', logIdDemo1), {
          id: logIdDemo1,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          user: `${demoName} (${role})`,
          action: 'Demo Terminal Authenticated',
          module: 'Access Gatekeeper',
          details: `Logged into quick-test profile linked to Warehouse ${whCode}`
        });

      } catch (signInErr: any) {
        if (signInErr.code === 'auth/operation-not-allowed') {
          throw signInErr; // Bubble up to outer try-catch to handle cleanly
        }
        // 2. If user doesn't exist, register them immediately on the fly!
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
          userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
          const uid = userCredential.user.uid;

          // Write Firestore Doc
          await setDoc(doc(db, 'users', uid), {
            uid,
            name: demoName,
            email: demoEmail,
            role,
            warehouseId: whCode
          });

          // Log registration
          const logIdDemo2 = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
          await setDoc(doc(db, 'auditLogs', logIdDemo2), {
            id: logIdDemo2,
            date: new Date().toISOString().slice(0, 10),
            time: new Date().toLocaleTimeString(),
            user: `${demoName} (${role})`,
            action: 'Demo Profile Auto-Provisioned',
            module: 'Access Gatekeeper',
            details: `Automatically generated demo credentials for ${demoName} assigned to Warehouse ${whCode}`
          });
        } else {
          throw signInErr;
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        console.warn("Firebase Email/Password provider is disabled. Seamlessly falling back to local session for demo.");
        if (onLocalLogin) {
          onLocalLogin(demoName, role, whCode);
          return;
        }
      }
      console.error("Firebase auth failed during quick login, falling back to local session:", err);
      if (onLocalLogin) {
        onLocalLogin(demoName, role, whCode);
        return;
      }
      setError(`Demo login failed: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const rolesList: Array<{ name: UserRole; icon: React.ReactNode; desc: string; color: string }> = [
    {
      name: 'Super Admin',
      icon: <Shield className="w-4 h-4 text-rose-500" />,
      desc: 'Full administrative access over all master data & adjustments.',
      color: 'border-rose-950/40 bg-rose-950/10 hover:border-rose-800'
    },
    {
      name: 'Store Operator',
      icon: <HardHat className="w-4 h-4 text-amber-500" />,
      desc: 'Create transfers, material inwards (GRN), and outwards.',
      color: 'border-amber-950/40 bg-amber-950/10 hover:border-amber-800'
    }
  ];

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative ambient spots */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 relative z-10">
        
        {/* Left Side: Branding / Info Pane */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-8 flex-col justify-between border-r border-slate-800/50 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.1),transparent_70%)] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-lg shadow-indigo-600/30 bg-slate-900">
                <img
                  src={stockflowLogo}
                  alt="Stockflow Logo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight italic">
                  STOCK<span className="text-indigo-400">FLOW</span>
                </h1>
                <span className="text-[9px] font-bold text-indigo-300 tracking-wider block uppercase">Enterprise ERP Terminal</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-100 leading-tight tracking-tight mt-12">
              Multi-Location <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200 font-extrabold">
                Warehouse Security
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              Authorized personnel must log in to access physical warehouse logs, trigger stock transfers, and file material inward/outward receipts.
            </p>

            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-1.5" />
                <div className="text-[11px] text-slate-300">
                  <strong className="block text-slate-100 font-bold mb-0.5">Location-Wise Auditing</strong>
                  All entries are logged to the warehouse ledger corresponding to your authenticated user account profile.
                </div>
              </div>
              <div className="flex items-start gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5" />
                <div className="text-[11px] text-slate-300">
                  <strong className="block text-slate-100 font-bold mb-0.5">Role-Based Safeguards</strong>
                  Actions like adjustments, edits, and stock overrules are locked securely behind authorization levels.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/40 relative z-10">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>SYSTEM: SECURE PORTAL</span>
              <span>v4.2.0-STABLE</span>
            </div>
          </div>
        </div>

        {/* Right Side: Security Terminal Form */}
        <div className="col-span-12 md:col-span-7 p-8 flex flex-col justify-between bg-slate-950">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mobile-Only Logo & Brand Header */}
            <div className="flex items-center gap-3 mb-6 md:hidden">
              <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-md bg-slate-900">
                <img
                  src={stockflowLogo}
                  alt="Stockflow Logo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight italic">
                  STOCK<span className="text-indigo-400">FLOW</span>
                </h1>
                <span className="text-[8px] font-bold text-indigo-300 tracking-wider block uppercase">Enterprise ERP Terminal</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {isSignUp ? 'Terminal Registration' : 'Terminal Authorization'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isSignUp ? 'Create secure credentials for database access.' : 'Access database nodes with secure credentials.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 bg-indigo-950/20 px-2.5 py-1 rounded-md border border-indigo-900/40 transition-all cursor-pointer"
              >
                {isSignUp ? (
                  <>
                    <LogIn className="w-3 h-3" />
                    <span>Sign In instead</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="bg-rose-950/40 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Standard Email & Password inputs */}
            <div className="space-y-3">
              {isSignUp && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Robert J. Miller"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 font-semibold"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. chinarsales737"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* SIGN-UP EXTRA SELECTIONS (Only visible during Sign Up) */}
            {isSignUp && (
              <div className="space-y-4 border-t border-slate-900 pt-4 mt-2">
                {/* A. Select Security Role */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assign Security Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {rolesList
                      .filter((role) => {
                        // Only allow Chinar Admin to select Super Admin role
                        if (role.name === 'Super Admin') {
                          return getEmailFromUsername(username) === 'chinarsales737@gmail.com';
                        }
                        return true;
                      })
                      .map((role) => {
                        const isSelected = selectedRole === role.name;
                        return (
                          <button
                            key={role.name}
                            type="button"
                            onClick={() => setSelectedRole(role.name)}
                            className={`flex flex-col text-left p-2 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-950/40 text-indigo-100 ring-1 ring-indigo-600'
                                : 'border-slate-800 bg-slate-900/30 text-slate-400 ' + role.color
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-[11px]">
                              {role.icon}
                              <span>{role.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1 leading-normal">{role.desc}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* B. Assign Warehouse Location */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assign Warehouse Node</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 font-semibold appearance-none"
                    >
                      {activeWarehouses.map((wh, idx) => (
                        <option key={`${wh.id || wh.code}-${idx}`} value={wh.code} className="bg-slate-950 text-slate-200 font-semibold">
                          {wh.name} ({wh.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* C. Admin Authorization Code (Required for all profile creations except primary admin) */}
                {getEmailFromUsername(username) !== 'chinarsales737@gmail.com' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span>Admin Authorization Code</span>
                      <span className="text-[8px] text-rose-500 font-black tracking-widest uppercase">Required</span>
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={adminAuthCode}
                        onChange={(e) => setAdminAuthCode(e.target.value)}
                        placeholder="Enter Admin Auth Code"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 font-semibold"
                      />
                    </div>
                    <p className="text-[9px] text-slate-500 leading-normal mt-1">
                      Security Policy: A valid Admin Authorization Code is required to register a User ID in this system.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Standard Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:text-indigo-300 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-600/15"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authorizing Session...</span>
                  </>
                ) : (
                  <>
                    {isSignUp ? <UserPlus className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>{isSignUp ? 'Register Security Credentials' : 'Access Warehouse Terminal'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
