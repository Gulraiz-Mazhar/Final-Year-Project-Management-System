// src/components/AuthPage.jsx
import PropTypes from 'prop-types';
import React, { useEffect, useState } from "react";

const AuthPage = ({ authMode, selectedRole, setSelectedRole, toggleAuthMode, handleAuthSubmit }) => {
  const isLogin = authMode === 'login';
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    setAnimate(false);
    setTimeout(() => setAnimate(true), 10);
  }, [authMode, selectedRole]);
  
  let idLabel = "Roll Number";
  let idPlaceholder = "e.g., BSCS51F22R001";
  if (selectedRole !== "Student") {
    idLabel = "Employee ID";
    idPlaceholder = "e.g., EMP-9988";
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-900">
      
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden bg-gray-900">
        <img
          src="https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2940&auto=format&fit=crop"
          alt="Campus Background"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        
        <div className="relative z-10 p-12 text-white max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
              <span className="material-symbols-outlined text-3xl">hub</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">FYPMS</h1>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight">Manage your academic journey.</h2>
          <p className="text-lg text-gray-300 leading-relaxed">
            The centralized platform for students, coordinators, and supervisors to collaborate on Final Year Projects.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 py-12 relative overflow-y-auto">
        
        <div className={`w-full max-w-md space-y-8 transition-all duration-500 ease-out ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          
          <div className="p-1.5 bg-gray-200 dark:bg-gray-800 rounded-xl flex space-x-1">
            {["Student", "Coordinator", "Supervisor"].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  selectedRole === r
                    ? "bg-white dark:bg-gray-700 shadow-sm text-blue-700 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-700/50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {isLogin ? "Welcome back" : "Create Account"}
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {isLogin
                ? `Login as ${selectedRole} to access your dashboard.`
                : "Fill in the details to get started."}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-5">
                <InputField label="Full Name" name="name" type="text" placeholder="John Doe" required />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField 
                    label={idLabel} 
                    name="universityId" 
                    type="text" 
                    placeholder={idPlaceholder} 
                    required={selectedRole === "Student"}
                  />
                  <InputField 
                    label="Batch" 
                    name="batch" 
                    type="text" 
                    placeholder="e.g., 2025-CS" 
                    required={selectedRole === "Student"}
                  />
                </div>
                
                <InputField label="Department" name="department" type="text" placeholder="Computer Science" />
                
                {selectedRole === "Supervisor" && (
                  <InputField 
                    label="Max Groups Supervising" 
                    name="maxGroupsSupervising" 
                    type="number" 
                    placeholder="e.g., 5" 
                    min="1" 
                    required 
                  />
                )}
              </div>
            )}

            <InputField label="Email Address" name="email" type="email" placeholder="name@university.edu" required />
            <InputField label="Password" name="password" type="password" placeholder="••••••••" required />
            
            {!isLogin && (
              <InputField label="Confirm Password" name="confirmPassword" type="password" placeholder="••••••••" required />
            )}

            <button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-600/20 active:scale-[0.98] mt-2"
            >
              {isLogin ? "Log In" : "Sign Up"}
            </button>
          </form>

          <div className="text-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button
              onClick={toggleAuthMode}
              className="font-bold text-blue-600 hover:underline ml-1"
            >
              {isLogin ? "Sign Up" : "Log In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InputField = ({ label, name, type, placeholder, min, required }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      required={required}
      min={min}
      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-12 px-4
                 text-gray-900 dark:text-white placeholder-gray-400
                 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                 transition-all duration-200 outline-none"
      placeholder={placeholder}
    />
  </div>
);

InputField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  min: PropTypes.string,
  required: PropTypes.bool,
};

AuthPage.propTypes = {
  authMode: PropTypes.string.isRequired,
  selectedRole: PropTypes.string.isRequired,
  setSelectedRole: PropTypes.func.isRequired,
  toggleAuthMode: PropTypes.func.isRequired,
  handleAuthSubmit: PropTypes.func.isRequired,
};

export default AuthPage;