import React, { useState } from "react";
import {
  Lock, Mail, Eye, EyeOff, ShieldCheck,
  CheckCircle2, ArrowRight, User, AlertCircle, Database
} from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import { saveAuthSession } from "../services/authService";
import { erpApi } from "../services/api";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";
import {
  validateRequiredText,
  validateEmail
} from "../utils/validators";

export default function LoginPage({
  onLoginSuccess,
  currentTheme = "light",
  onSelectTheme,
  showToast,
}) {
  const [mode, setMode] = useState("signin"); // "signin" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Administrator");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState(null);

  const validate = () => {
    const errs = {};

    if (mode === "register") {
      const nameVal = validateRequiredText(name, "Full Name", 2);
      if (!nameVal.isValid) errs.name = nameVal.error;

      const emailVal = validateEmail(username, true);
      if (!emailVal.isValid) errs.username = emailVal.error;

      if (!password || password.length < 6) {
        errs.password = "Password must be at least 6 characters for registration.";
      }
    } else {
      if (!username.trim()) {
        errs.username = "Username or Email is required.";
      }
      if (!password) {
        errs.password = "Password is required.";
      } else if (password.length < 4) {
        errs.password = "Password must be at least 4 characters.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setLoginFeedback(null);

    const cleanEmail = username.trim();
    const cleanPass = password.trim();

    try {
      if (mode === "register") {
        const apiRes = await erpApi.register({
          name: name.trim(),
          email: cleanEmail,
          password: cleanPass,
          role: "admin",
        });
        const authData = apiRes.data;
        saveAuthSession(authData.token, authData.user);
        if (showToast) showToast(`✓ Account created in MySQL! Welcome, ${authData.user?.name || name.trim()}.`);
        onLoginSuccess(authData.user);
      } else {
        // Strict JWT Sign-in against MySQL
        const apiRes = await erpApi.login({
          email: cleanEmail,
          password: cleanPass,
        });
        const authData = apiRes.data;
        saveAuthSession(authData.token, authData.user);
        if (showToast) showToast(`✓ Authenticated successfully! Welcome, ${authData.user?.name || cleanEmail}.`);
        onLoginSuccess(authData.user);
      }
    } catch (err) {
      setLoginFeedback({
        type: "error",
        message: err.message || "Authentication failed. Please verify your email and password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-viewport">
      {/* Ambient background decoration */}
      <div className="login-bg-mesh" />

      {/* Top Header with Brand and Theme Selector */}
      <header className="login-topbar">
        <div className="login-brand-pill">
          <img src="/logo.png" alt="Laxmi Enterprises" className="login-mini-logo" />
          <span>LAXMI ENTERPRISES ERP</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#059669",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "4px 10px",
              borderRadius: 20
            }}
          >
            
          </div>
          {onSelectTheme && (
            <ThemeSelector currentTheme={currentTheme} onSelectTheme={onSelectTheme} />
          )}
        </div>
      </header>

      {/* Perfectly Centered Login Container */}
      <div className="login-container">
        <div className="login-card">
          {/* Logo & Header */}
          <div className="login-header">
            <div className="login-logo-halo">
              <img src="/logo.png" alt="Laxmi Enterprises" className="login-hero-logo" />
            </div>
            <h2 className="login-brand-title">
              LAXMI ENTERPRISES
            </h2>
            <p className="login-brand-subtitle">
              Enterprise Supplies, Hardware & Agro Trading Portal
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab-btn ${mode === "signin" ? "active" : ""}`}
              onClick={() => { setMode("signin"); setErrors({}); setLoginFeedback(null); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`login-tab-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setErrors({}); setLoginFeedback(null); }}
            >
              Register Admin
            </button>
          </div>

          {/* Feedback Alert */}
          {loginFeedback && (
            <div className={`login-feedback ${loginFeedback.type === "error" ? "error" : "success"}`}>
              {loginFeedback.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{loginFeedback.message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {mode === "register" && (
              <div className="form-group">
                <label>
                  Full Name <RequiredStar />
                </label>
                <div className="login-input-wrap">
                  <User size={16} className="login-input-icon" />
                  <input
                    type="text"
                    className={`login-input ${errors.name ? "is-invalid" : ""}`}
                    placeholder="e.g. Ramesh Patil"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                    }}
                  />
                </div>
                <FieldError error={errors.name} />
              </div>
            )}

            <div className="form-group">
              <label>
                Email / Username <RequiredStar />
              </label>
              <div className="login-input-wrap">
                <Mail size={16} className="login-input-icon" />
                <input
                  type="text"
                  className={`login-input ${errors.username ? "is-invalid" : ""}`}
                  placeholder="admin@laxmienterprises.com"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) setErrors(prev => ({ ...prev, username: null }));
                  }}
                />
              </div>
              <FieldError error={errors.username} />
            </div>

            <div className="form-group">
              <label>
                Password <RequiredStar />
              </label>
              <div className="login-input-wrap">
                <Lock size={16} className="login-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className={`login-input ${errors.password ? "is-invalid" : ""}`}
                  placeholder={mode === "register" ? "Minimum 6 characters" : "Enter password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: null }));
                  }}
                />
                <button
                  type="button"
                  className="login-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password view"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError error={errors.password} />
            </div>

            <button
              type="submit"
              className="primary"
              disabled={isLoading}
              style={{
                width: "100%",
                height: 46,
                borderRadius: 10,
                fontWeight: 700,
                fontSize: "0.95rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 6
              }}
            >
              <span>{isLoading ? "Authenticating..." : mode === "signin" ? "Sign In to ERP Portal" : "Create Admin Account"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Security badge at bottom */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              textAlign: "center"
            }}
          >
            <ShieldCheck size={14} style={{ color: "#10b981" }} />
            <span>256-Bit SSL • JWT & Bcrypt Protected • MySQL 8.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
