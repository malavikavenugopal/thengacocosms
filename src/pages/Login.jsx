import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Navigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalContext';
import { LogIn, Lock, Mail, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('admin@thengacoco.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const { currentUser } = useGlobalState();
  const navigate = useNavigate();

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Successfully logged in!');
      navigate('/');
    } catch (error) {
      console.error(error);
      let message = 'Login failed. Please check your credentials.';
      if (error.code === 'auth/user-not-found') message = 'No account found. Use the setup button below.';
      if (error.code === 'auth/wrong-password') message = 'Incorrect password.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async () => {
    setIsSettingUp(true);
    const toastId = toast.loading('Creating admin account...');
    try {
      await createUserWithEmailAndPassword(auth, 'admin@thengacoco.com', 'admin123');
      toast.success('Admin account created! You can now sign in.', { id: toastId });
      // Auto login after setup
      handleLogin();
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Admin account already exists. Please try signing in.', { id: toastId });
      } else {
        toast.error('Setup failed: ' + error.message, { id: toastId });
      }
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md p-4 relative z-10">
        <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 p-8 md:p-10">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-4 transform rotate-3">
              <LogIn size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Portal</h1>
            <p className="text-slate-500 mt-2 text-sm font-medium uppercase tracking-widest">Thenga Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  placeholder="admin@thengacoco.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              loading={isLoading}
              disabled={isSettingUp}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-100 flex items-center justify-center gap-2 group h-auto"
            >
              Sign In <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>
 
          <div className="mt-8 pt-6 border-t border-slate-50 text-center space-y-4">
            <Button
              onClick={handleSetup}
              loading={isSettingUp}
              disabled={isLoading}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-indigo-600 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 transition-colors h-auto"
            >
              <Sparkles size={16} />
              Setup Admin Account
            </Button>
            <p className="text-xs text-slate-400 font-medium italic">"Cloud-synchronized stock management"</p>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-400 text-xs font-medium">
          &copy; {new Date().getFullYear()} Thenga Management System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
