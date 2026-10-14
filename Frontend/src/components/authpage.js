"use client";

import { useState, useEffect, useContext } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiPost, getErrorMessage } from "../utils/api";

export default function AuthPage({ onAuthSuccess }) {
  const auth = useContext(AuthContext);
  const { notify } = useToast();
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
      } else if (err.statusCode === 401 && mode === "signIn") {
        setLocalError("Email or password is incorrect. New here? Choose Sign Up to create an account.");
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
      notify({
        type: "success",
        title: "Verification code sent",
        message: data.message || "Check your email for the new code.",
      });
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
      notify({
        type: "success",
        title: "Password reset",
        message: "Your password has been reset. Sign in with your new password.",
      });
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(47,129,247,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,139,253,0.08),transparent_24%),#0d1117] px-4 py-10 text-[#e6edf3] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-[#30363d] bg-[#161b22]/95 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-[#30363d] bg-[#0d1117] p-8 lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(47,129,247,0.13),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(56,139,253,0.08),transparent_30%)]" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2f81f7] text-xl font-black text-white shadow-lg shadow-blue-950/40">
                  D
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[#8b949e]">AI Workspace</p>
                  <h2 className="text-2xl font-bold text-white">Documind</h2>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.18em] text-[#58a6ff]">Private Knowledge Access</p>
                <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">
                  Ask questions from your documents in seconds.
                </h1>
                <p className="max-w-md text-base leading-7 text-slate-300">
                  Search, chat, and reason over your uploaded PDFs with a secure workspace built for fast answers and focused workflows.
                </p>
              </div>
            </div>

            <div className="relative z-10 overflow-hidden rounded-2xl border border-[#30363d] bg-[#161b22]/85 p-4 shadow-2xl shadow-black/20">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                  <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                  <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-emerald-200">
                  Workspace ready
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/55 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f6feb]/15 text-[#58a6ff]" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7">
                    <path d="M7 3.75h6l4 4v12.5H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z" />
                    <path d="M13 4v4h4M8.5 13h7M8.5 16.5h5" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-100">Product handbook.pdf</p>
                  <p className="mt-1 text-[10px] text-slate-400">Indexed · 24 pages · Just now</p>
                </div>
                <span className="text-xs font-medium text-[#3fb950]">Ready</span>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#1f6feb]/10 px-3 py-2.5 text-xs text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1f6feb]/20 text-[#58a6ff]" aria-hidden="true">✦</span>
                <span className="truncate">Ask anything. Get answers grounded in your files.</span>
                <span className="ml-auto text-[#58a6ff]" aria-hidden="true">↗</span>
              </div>
            </div>
          </div>

          <div className="w-full p-5 sm:p-7 lg:p-8">
            <div className="mx-auto max-w-md">
              {mode === "signIn" || mode === "signUp" ? (
                <>
                  <div className="mb-8 flex flex-col gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-[#58a6ff] font-semibold">
                        Welcome to Documind
                      </p>
                      <h1 className="mt-3 text-3xl font-semibold text-white">{mode === "signIn" ? "Sign In" : "Create Account"}</h1>
                      <p className="mt-2 text-sm text-slate-400">
                        {mode === "signIn"
                          ? "Access your dashboard and continue your work."
                          : "Create a new account to save your workspace settings."}
                      </p>
                    </div>

                    <div className="flex items-center rounded-xl border border-[#30363d] bg-[#0d1117] p-1 text-sm uppercase tracking-[0.1em] text-[#8b949e]">
                      <button
                        type="button"
                        onClick={() => {
                          console.log("Switching mode to signIn");
                          setMode("signIn");
                        }}
                        aria-pressed={mode === "signIn"}
                        className={`flex-1 rounded-lg px-4 py-3 transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] ${
                          mode === "signIn"
                            ? "bg-[#1f6feb] text-white shadow-md shadow-blue-950/40"
                            : "hover:bg-[#21262d] hover:text-[#e6edf3]"
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
                        aria-pressed={mode === "signUp"}
                        className={`flex-1 rounded-lg px-4 py-3 transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] ${
                          mode === "signUp"
                            ? "bg-[#1f6feb] text-white shadow-md shadow-blue-950/40"
                            : "hover:bg-[#21262d] hover:text-[#e6edf3]"
                        }`}
                      >
                        Sign Up
                      </button>
                    </div>
                  </div>

                  <div className="mb-6 flex justify-center">
                    {mounted && (
                      <div className="flex w-full justify-center">
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
                          className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25"
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
                        className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25"
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
                        className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25"
                      />
                    </label>

                    {mode === "signIn" && (
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="h-4 w-4 rounded border-[#30363d] bg-[#0d1117] text-[#2f81f7] focus:ring-[#2f81f7]"
                          />
                          Remember me
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgotPassword");
                            setLocalError("");
                          }}
                          className="text-[#58a6ff] hover:text-[#79c0ff] cursor-pointer"
                        >
                          Forgot?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#3b82f6] bg-[#1f6feb] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-950/30 transition duration-200 hover:-translate-y-0.5 hover:bg-[#388bfd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
                    >
                      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" aria-hidden="true" />}
                      {loading ? "Please wait…" : mode === "signIn" ? "Sign In" : "Create Account"}
                    </button>
                  </form>
                </>
              ) : mode === "verifyOtp" ? (
                <>
                  <div className="mb-8 flex flex-col gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-[#58a6ff] font-semibold">
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
                        className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25 placeholder:text-slate-600"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full rounded-xl border border-[#3b82f6] bg-[#1f6feb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {loading ? "Verifying..." : "Verify & Continue"}
                    </button>

                    <div className="flex flex-col gap-3 text-center text-sm">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="font-semibold text-[#58a6ff] hover:text-[#79c0ff] cursor-pointer disabled:opacity-50"
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
                      <p className="text-sm uppercase tracking-[0.18em] text-[#58a6ff] font-semibold">
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
                        className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl border border-[#3b82f6] bg-[#1f6feb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
                      <p className="text-sm uppercase tracking-[0.18em] text-[#58a6ff] font-semibold">
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
                        className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25 placeholder:text-slate-600"
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
                        className="auth-textbox mt-2 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#2f81f7] focus:ring-2 focus:ring-[#2f81f7]/25"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full rounded-xl border border-[#3b82f6] bg-[#1f6feb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
                  By continuing, you agree to our <span className="text-[#58a6ff]">Terms</span> and <span className="text-[#58a6ff]">Privacy</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
