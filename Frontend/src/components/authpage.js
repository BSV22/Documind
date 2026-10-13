"use client";

import { useState, useEffect, useContext } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext";
import { apiPost, getErrorMessage } from "../utils/api";

export default function AuthPage({ onAuthSuccess }) {
  const auth = useContext(AuthContext);
  const [mode, setMode] = useState("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [otp, setOtp] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    console.log("AuthPage mounted. Current mode:", mode);
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError("");
    
    try {
      const endpoint = mode === "signIn" ? "/api/auth/signin" : "/api/auth/signup";
      const payload = {
        email,
        password,
        ...(mode === "signUp" && { name }),
      };

      const data = await apiPost(endpoint, payload);

      if (data.status === "verification_required") {
        setVerificationEmail(data.email);
        setMode("verifyOtp");
        setOtp("");
      } else {
        auth.login(null, data.user);
        onAuthSuccess?.(data.user);
      }
    } catch (err) {
      console.error("Authentication error:", err);
      
      // Check for specific error messages indicating verification pending
      const errorMsg = getErrorMessage(err);
      if (err.message?.includes("verification pending") || errorMsg.includes("verification")) {
        setVerificationEmail(email);
        setMode("verifyOtp");
        setOtp("");
      } else {
        setLocalError(errorMsg || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError("");

    try {
      const data = await apiPost("/api/auth/verify-otp", {
        email: verificationEmail,
        otp
      });

      auth.login(null, data.user);
      onAuthSuccess?.(data.user);
    } catch (err) {
      console.error("OTP verification error:", err);
      setLocalError(getErrorMessage(err) || "OTP verification failed. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setLocalError("");

    try {
      const data = await apiPost("/api/auth/resend-otp", {
        email: verificationEmail
      });
      alert(data.message || "Verification code resent successfully!");
    } catch (err) {
      console.error("Resend OTP error:", err);
      setLocalError(getErrorMessage(err) || "Failed to resend verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError("");

    try {
      const data = await apiPost("/api/auth/forgot-password", { email });
      setVerificationEmail(email);
      setMode("resetPassword");
      setOtp("");
      setNewPassword("");
    } catch (err) {
      console.error("Forgot password error:", err);
      setLocalError(getErrorMessage(err) || "Failed to send password reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError("");

    try {
      const data = await apiPost("/api/auth/reset-password", {
        email: verificationEmail,
        otp,
        new_password: newPassword
      });
      alert("Password has been reset successfully! Please sign in with your new password.");
      setMode("signIn");
      setPassword("");
      setNewPassword("");
      setEmail(verificationEmail);
    } catch (err) {
      console.error("Reset password error:", err);
      setLocalError(getErrorMessage(err) || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setLocalError("");
    try {
      const jwtToken = credentialResponse.credential;
      const data = await apiPost("/api/auth/google", { token: jwtToken });

      auth.login(null, data.user);
      onAuthSuccess?.(data.user);
    } catch (err) {
      console.error("Google login error:", err);
      setLocalError(getErrorMessage(err) || "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setLocalError("Google login failed. Please try again.");
    console.error("Google login failed");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),transparent_24%),#020817] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-900/70 shadow-[0_30px_90px_rgba(15,23,42,0.7)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),transparent_30%)]" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-xl font-black text-slate-950 shadow-lg shadow-cyan-500/30">
                  D
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">AI Workspace</p>
                  <h2 className="text-2xl font-bold text-white">Documind</h2>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-300">Private Knowledge Access</p>
                <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">
                  Ask questions from your documents in seconds.
                </h1>
                <p className="max-w-md text-base leading-7 text-slate-300">
                  Search, chat, and reason over your uploaded PDFs with a secure workspace built for fast answers and focused workflows.
                </p>
              </div>
            </div>

            <div className="relative z-10 grid gap-3">
              {[
                "Smart PDF indexing",
                "Secure document chat",
                "Fast workspace onboarding",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full p-5 sm:p-7 lg:p-8">
            <div className="mx-auto max-w-md">
              {mode === "signIn" || mode === "signUp" ? (
                <>
                  <div className="mb-8 flex flex-col gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                        Welcome to Documind
                      </p>
                      <h1 className="mt-3 text-3xl font-semibold text-white">{mode === "signIn" ? "Sign In" : "Create Account"}</h1>
                      <p className="mt-2 text-sm text-slate-400">
                        {mode === "signIn"
                          ? "Access your dashboard and continue your work."
                          : "Create a new account to save your workspace settings."}
                      </p>
                    </div>

                    <div className="flex items-center rounded-3xl bg-slate-950/80 p-1 text-sm uppercase tracking-[0.18em] text-slate-400">
                      <button
                        type="button"
                        onClick={() => {
                          console.log("Switching mode to signIn");
                          setMode("signIn");
                        }}
                        className={`flex-1 rounded-3xl px-4 py-3 transition cursor-pointer ${
                          mode === "signIn"
                            ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                            : "hover:bg-slate-800"
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          console.log("Switching mode to signUp");
                          setMode("signUp");
                        }}
                        className={`flex-1 rounded-3xl px-4 py-3 transition cursor-pointer ${
                          mode === "signUp"
                            ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                            : "hover:bg-slate-800"
                        }`}
                      >
                        Sign Up
                      </button>
                    </div>
                  </div>

                  <div className="mb-6 flex justify-center">
                    {mounted && (
                      <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-2.5">
                        <GoogleLogin
                          onSuccess={handleGoogleSuccess}
                          onError={handleGoogleError}
                          theme="filled_blue"
                          size="large"
                          shape="pill"
                        />
                      </div>
                    )}
                  </div>

                  {localError && (
                    <div className="mb-4 rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                      {localError}
                    </div>
                  )}

                  <div className="mb-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-700"></div>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">or continue with email</span>
                    <div className="h-px flex-1 bg-slate-700"></div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "signUp" && (
                      <label className="block text-sm text-slate-200">
                        <span className="mb-2 block">Name</span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                        />
                      </label>
                    )}

                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </label>

                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Password</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </label>

                    {mode === "signIn" && (
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                          />
                          Remember me
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgotPassword");
                            setLocalError("");
                          }}
                          className="text-cyan-300 hover:text-cyan-200 cursor-pointer"
                        >
                          Forgot?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {loading ? "Loading..." : mode === "signIn" ? "Sign In" : "Create Account"}
                    </button>
                  </form>
                </>
              ) : mode === "verifyOtp" ? (
                <>
                  <div className="mb-8 flex flex-col gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                        Verify Email
                      </p>
                      <h1 className="mt-3 text-3xl font-semibold text-white">Enter OTP Code</h1>
                      <p className="mt-2 text-sm text-slate-400">
                        We sent a 6-digit verification code to <span className="font-semibold text-white break-all">{verificationEmail}</span>.
                      </p>
                    </div>
                  </div>

                  {localError && (
                    <div className="mb-4 rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                      {localError}
                    </div>
                  )}

                  <form onSubmit={handleOtpSubmit} className="space-y-6">
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Verification Code</span>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                        placeholder="123456"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-600"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {loading ? "Verifying..." : "Verify & Continue"}
                    </button>

                    <div className="flex flex-col gap-3 text-center text-sm">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer disabled:opacity-50"
                      >
                        Resend Verification Code
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          console.log("Going back to signIn mode");
                          setMode("signIn");
                          setLocalError("");
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                </>
              ) : mode === "forgotPassword" ? (
                <>
                  <div className="mb-8 flex flex-col gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                        Forgot Password
                      </p>
                      <h1 className="mt-3 text-3xl font-semibold text-white">Reset Your Password</h1>
                      <p className="mt-2 text-sm text-slate-400">
                        Enter your email address and we will send you a 6-digit password reset code.
                      </p>
                    </div>
                  </div>

                  {localError && (
                    <div className="mb-4 rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                      {localError}
                    </div>
                  )}

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {loading ? "Sending..." : "Send Reset Code"}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signIn");
                          setLocalError("");
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-8 flex flex-col gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                        Reset Password
                      </p>
                      <h1 className="mt-3 text-3xl font-semibold text-white">Enter New Password</h1>
                      <p className="mt-2 text-sm text-slate-400">
                        We sent a 6-digit reset code to <span className="font-semibold text-white break-all">{verificationEmail}</span>.
                      </p>
                    </div>
                  </div>

                  {localError && (
                    <div className="mb-4 rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                      {localError}
                    </div>
                  )}

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Reset Code</span>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                        placeholder="123456"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-600"
                      />
                    </label>

                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">New Password</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {loading ? "Resetting..." : "Reset Password"}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signIn");
                          setLocalError("");
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                </>
              )}

              <div className="mt-6 border-t border-slate-800 pt-4 text-center text-sm text-slate-500">
                <p>
                  By continuing, you agree to our <span className="text-cyan-300">Terms</span> and <span className="text-cyan-300">Privacy</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
