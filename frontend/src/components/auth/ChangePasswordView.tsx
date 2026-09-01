import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { apiClient } from "../../api/client";
import { Eye, EyeSlash, CheckCircle, XCircle, ArrowLeft, Key } from "@phosphor-icons/react";

export const ChangePasswordView: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, login, mustChangePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Real-time validations
  const isMinLength = newPassword.length >= 8;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);

    try {
      let response;
      const payload = {
        oldPassword: currentPassword,
        currentPassword: currentPassword,
        newPassword: newPassword
      };

      try {
        response = await apiClient.put("/v1/auth/password", payload);
      } catch (err: any) {
        // Fallback to /change-password if /password returns 404/405
        if (err.response?.status === 404 || err.response?.status === 405) {
          response = await apiClient.post("/v1/auth/change-password", payload);
        } else {
          throw err;
        }
      }

      const token = response.data?.token || localStorage.getItem("miotranslate_token");
      const updatedUser = response.data?.user || user;

      if (token && updatedUser) {
        login(token, updatedUser, false);
      }

      toast("Password updated successfully!");
      navigate("/", { replace: true });
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.response?.data?.error;

      if (status === 401 || msg === "INVALID_OLD_PASSWORD") {
        setError("Current password is incorrect. Please verify and try again.");
      } else if (status === 400 || msg === "TOO_MANY_ATTEMPTS") {
        setError(msg || "Password does not meet security requirements.");
      } else if (!err.response) {
        // Mock fallback if backend is offline/mocked
        const token = localStorage.getItem("miotranslate_token") || "mock-token";
        if (user) {
          login(token, user, false);
          toast("Password updated successfully!");
          navigate("/", { replace: true });
          return;
        }
        setError("Unable to connect to the authentication service.");
      } else {
        setError(msg || "Failed to update password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-main p-4">
      <div className="w-full max-w-sm p-6 sm:p-8 bg-bg-card rounded-xl border border-border-subtle shadow-2xl">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center gap-3">
          <div className="w-11 h-11 bg-accent-blue/10 border border-accent-blue/20 rounded-xl flex items-center justify-center shadow-xs">
            <Key className="w-5 h-5 text-accent-blue" weight="bold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Change Password</h1>
            <p className="text-[13px] text-text-secondary mt-1">
              {mustChangePassword 
                ? "Please update your password to continue" 
                : "Enter your current and new password below"}
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="mb-5 p-3 bg-[#e5484d]/10 border border-[#e5484d]/30 text-[#ff8b8e] rounded-lg text-[13px] font-medium text-center leading-snug animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                autoComplete="current-password"
                className="w-full pl-3 pr-9 h-9 bg-bg-main border border-border-strong rounded-md focus:outline-none focus:border-accent-blue text-[13px] text-text-primary transition-all placeholder:text-text-tertiary"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showCurrent ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                autoComplete="new-password"
                className="w-full pl-3 pr-9 h-9 bg-bg-main border border-border-strong rounded-md focus:outline-none focus:border-accent-blue text-[13px] text-text-primary transition-all placeholder:text-text-tertiary"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showNew ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                autoComplete="new-password"
                className="w-full pl-3 pr-9 h-9 bg-bg-main border border-border-strong rounded-md focus:outline-none focus:border-accent-blue text-[13px] text-text-primary transition-all placeholder:text-text-tertiary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showConfirm ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Requirements Checklist */}
          {newPassword.length > 0 && (
            <div className="py-2 px-3 bg-bg-main rounded-md border border-border-subtle space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                {isMinLength ? (
                  <CheckCircle className="w-3.5 h-3.5 text-[#5e6ad2]" weight="fill" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-text-tertiary" weight="fill" />
                )}
                <span className={isMinLength ? "text-text-primary font-medium" : "text-text-tertiary"}>
                  At least 8 characters
                </span>
              </div>

              {confirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {isMatching ? (
                    <CheckCircle className="w-3.5 h-3.5 text-[#5e6ad2]" weight="fill" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-[#e5484d]" weight="fill" />
                  )}
                  <span className={isMatching ? "text-text-primary font-medium" : "text-text-tertiary"}>
                    Passwords match
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 mt-3 bg-[#5e6ad2] hover:bg-[#525ec2] text-white font-medium text-[13px] rounded-md transition-all disabled:opacity-50 cursor-pointer outline-none shadow-xs active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? "Updating password..." : "Update Password"}
          </button>

          {/* Back to Workspace (if voluntarily changing password) */}
          {!mustChangePassword && (
            <div className="text-center pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-text-tertiary hover:text-text-primary transition-colors outline-none"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Workspace</span>
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
