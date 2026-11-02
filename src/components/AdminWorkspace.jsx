import React, { useState, useEffect } from "react";
import {
  Building2, Sliders, UserCheck, ShieldCheck, Save, Mail, Phone, MapPin,
  Plus, CheckCircle2, Lock, Key, RefreshCw, AlertTriangle, Eye, EyeOff,
  Target, IndianRupee, CheckCheck, XCircle
} from "lucide-react";
import { formatIndianCurrency, formatPercent } from "../utils/formatters";
import {
  validateRequiredText,
  validateEmail,
  validateMobile,
  validateGSTIN,
  validatePAN
} from "../utils/validators";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";
import { erpApi } from "../services/api";
import { saveAuthSession } from "../services/authService";

export default function AdminWorkspace({ 
  adminProfile = {}, 
  setAdminProfile, 
  company = {}, 
  setCompany, 
  systemPrefs = {}, 
  setSystemPrefs,
  onOpenCredsModal
}) {
  const [activeTab, setActiveTab] = useState("company");
  const [toast, setToast] = useState(null);

  // Team members list directly from MySQL
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "sales",
    phone: "",
    designation: "Sales Executive"
  });

  // Local form states
  const [compForm, setCompForm] = useState(company);
  const [profForm, setProfForm] = useState(adminProfile);
  const [prefsForm, setPrefsForm] = useState(systemPrefs);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Form error states
  // Live DB Health State
  const [dbStatus, setDbStatus] = useState("Checking...");

  // Fiscal Targets State
  const [targetFy, setTargetFy] = useState("FY 2026-27");
  const [targetsList, setTargetsList] = useState([]);
  const [quarterlyProgress, setQuarterlyProgress] = useState([]);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [isSavingTargets, setIsSavingTargets] = useState(false);

  const [compErrors, setCompErrors] = useState({});
  const [profErrors, setProfErrors] = useState({});
  const [memberErrors, setMemberErrors] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Consistency Check State
  const [consistencyReport, setConsistencyReport] = useState(null);
  const [isLoadingConsistency, setIsLoadingConsistency] = useState(false);

  const loadConsistencyReport = async () => {
    setIsLoadingConsistency(true);
    try {
      const res = await erpApi.getConsistencyReport();
      if (res?.data) {
        setConsistencyReport(res.data);
      }
    } catch (e) {
      console.warn("Could not run consistency check:", e.message);
    } finally {
      setIsLoadingConsistency(false);
    }
  };

  useEffect(() => {
    if (activeTab === "consistency") {
      loadConsistencyReport();
    }
  }, [activeTab]);

  // Sync if parent state changes
  useEffect(() => {
    if (company && Object.keys(company).length > 0) setCompForm(company);
  }, [company]);

  useEffect(() => {
    if (adminProfile && Object.keys(adminProfile).length > 0) setProfForm(adminProfile);
  }, [adminProfile]);

  useEffect(() => {
    if (systemPrefs && Object.keys(systemPrefs).length > 0) setPrefsForm(systemPrefs);
  }, [systemPrefs]);

  // Load live team members from MySQL
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await erpApi.getUsers();
      if (res?.data && Array.isArray(res.data)) {
        setTeamMembers(res.data);
      }
    } catch (e) {
      console.warn("Could not load users:", e.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Live Database Health Check
  useEffect(() => {
    let mounted = true;
    erpApi.checkHealth()
      .then(() => { if (mounted) setDbStatus("MySQL Connected"); })
      .catch(() => { if (mounted) setDbStatus("Offline / Reconnecting"); });
    return () => { mounted = false; };
  }, []);

  // Load live targets from MySQL
  const loadTargets = async (fy) => {
    setIsLoadingTargets(true);
    try {
      const [tgtRes, qRes] = await Promise.allSettled([
        erpApi.getTargets({ fiscalYear: fy }),
        erpApi.getQuarterlyBreakdown({ fiscalYear: fy })
      ]);
      if (tgtRes.status === "fulfilled" && tgtRes.value?.data) {
        const raw = Array.isArray(tgtRes.value.data) ? tgtRes.value.data : [];
        if (raw.length > 0) {
          setTargetsList(raw);
        }
      }
      if (qRes.status === "fulfilled" && qRes.value?.data) {
        setQuarterlyProgress(Array.isArray(qRes.value.data) ? qRes.value.data : []);
      }
    } catch (e) {
      console.warn("Could not load targets:", e.message);
    } finally {
      setIsLoadingTargets(false);
    }
  };

  useEffect(() => {
    loadTargets(targetFy);
  }, [targetFy]);

  const handleSaveTargets = async (e) => {
    e.preventDefault();
    setIsSavingTargets(true);
    try {
      const payload = targetsList.map(t => ({
        fiscalYear: targetFy,
        quarter: t.quarter,
        targetAmount: Number(t.targetAmount) || 0,
        notes: t.notes || ""
      }));
      await erpApi.saveBulkTargets(payload);
      showNotification(`✓ Sales targets for ${targetFy} saved directly in MySQL!`);
      await loadTargets(targetFy);
    } catch (err) {
      showNotification(`⚠️ Could not save targets: ${err.message}`);
    } finally {
      setIsSavingTargets(false);
    }
  };

  const showNotification = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // 1. SAVE COMPANY PROFILE TO MYSQL
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    const errs = {};

    const nameVal = validateRequiredText(compForm.name, "Company Legal Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    const gstinVal = validateGSTIN(compForm.gstin, true);
    if (!gstinVal.isValid) errs.gstin = gstinVal.error;

    const panVal = validatePAN(compForm.pan, true);
    if (!panVal.isValid) errs.pan = panVal.error;

    const emailVal = validateEmail(compForm.email, true);
    if (!emailVal.isValid) errs.email = emailVal.error;

    const phoneVal = validateMobile(compForm.phone, true);
    if (!phoneVal.isValid) errs.phone = phoneVal.error;

    const addrVal = validateRequiredText(compForm.address, "Registered Address", 5);
    if (!addrVal.isValid) errs.address = addrVal.error;

    if (Object.keys(errs).length > 0) {
      setCompErrors(errs);
      return;
    }

    setCompErrors({});
    try {
      const res = await erpApi.syncCompany(compForm);
      if (setCompany) setCompany(compForm);
      showNotification("✓ Company Profile saved directly in MySQL Database!");
    } catch (err) {
      showNotification(`⚠️ Failed to save company: ${err.message}`);
    }
  };

  // 2. SAVE ADMIN PROFILE (NAME, EMAIL, PHONE) DIRECTLY TO MYSQL VIA JWT
  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    const errs = {};

    const nameVal = validateRequiredText(profForm.name, "Admin Display Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    const emailVal = validateEmail(profForm.email, true);
    if (!emailVal.isValid) errs.email = emailVal.error;

    if (profForm.phone && profForm.phone.trim()) {
      const phoneVal = validateMobile(profForm.phone, false);
      if (!phoneVal.isValid) errs.phone = phoneVal.error;
    }

    if (Object.keys(errs).length > 0) {
      setProfErrors(errs);
      return;
    }

    setProfErrors({});
    setIsSavingProfile(true);

    try {
      const res = await erpApi.updateProfile({
        name: profForm.name.trim(),
        email: profForm.email.trim(),
        phone: profForm.phone ? profForm.phone.trim() : "",
      });

      const updatedUser = res.data?.user || res.data;
      const newToken = res.data?.token;

      if (newToken && updatedUser) {
        saveAuthSession(newToken, updatedUser);
      }

      if (setAdminProfile) {
        setAdminProfile(prev => ({ ...prev, ...updatedUser }));
      }

      showNotification("✓ Admin details saved directly in MySQL database!");
    } catch (err) {
      showNotification(`⚠️ Could not update profile: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 3. CHANGE PASSWORD SECURELY IN MYSQL VIA BCRYPT
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const errs = {};

    if (!passwordForm.currentPassword) {
      errs.currentPassword = "Current password is required";
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      errs.newPassword = "New password must be at least 6 characters long";
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    setPasswordErrors({});
    setIsUpdatingPassword(true);

    try {
      const res = await erpApi.updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res.data?.token) {
        saveAuthSession(res.data.token, res.data.user);
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      showNotification("✓ Password changed and encrypted with bcrypt in MySQL database!");
    } catch (err) {
      setPasswordErrors({ form: err.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 4. SAVE SYSTEM PREFERENCES
  const handleSavePrefs = (e) => {
    e.preventDefault();
    if (setSystemPrefs) setSystemPrefs(prefsForm);
    localStorage.setItem("le_system_prefs", JSON.stringify(prefsForm));
    showNotification("✓ Operational rules & warehouse preferences saved!");
  };

  // 5. ADD TEAM MEMBER DIRECTLY TO MYSQL
  const handleAddMember = async (e) => {
    e.preventDefault();
    const errs = {};

    const nameVal = validateRequiredText(newMemberForm.name, "Full Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    const emailVal = validateEmail(newMemberForm.email, true);
    if (!emailVal.isValid) errs.email = emailVal.error;

    if (!newMemberForm.password || newMemberForm.password.length < 6) {
      errs.password = "Initial password must be at least 6 characters";
    }

    if (Object.keys(errs).length > 0) {
      setMemberErrors(errs);
      return;
    }

    setMemberErrors({});

    try {
      await erpApi.createUser({
        name: newMemberForm.name.trim(),
        email: newMemberForm.email.trim().toLowerCase(),
        password: newMemberForm.password,
        role: newMemberForm.role,
        designation: newMemberForm.designation || "Staff",
      });

      await loadUsers();
      setIsAddMemberOpen(false);
      setNewMemberForm({ name: "", email: "", password: "", role: "sales", phone: "", designation: "Staff" });
      showNotification(`✓ Added ${newMemberForm.name} directly to MySQL database!`);
    } catch (err) {
      setMemberErrors({ form: err.message });
    }
  };

    return (
    <div className="page">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* Admin Status Banner */}
      <div className="admin-header-banner">
        <div className="admin-banner-content">
          <h2>
            <ShieldCheck size={24} style={{ color: "var(--primary)" }} />
            Laxmi Enterprises Admin Workspace
          </h2>
          <p>
            Centralized management console for enterprise settings, company registry, user permissions, and database controls.
          </p>
        </div>
        <div className="admin-banner-meta">
          <span className="badge brand">Status: Operational (v2026.1)</span>
          <span className="badge success">Role: {adminProfile.role || "Admin"}</span>
          <span className="badge" style={{ background: dbStatus === "MySQL Connected" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)", color: dbStatus === "MySQL Connected" ? "#10b981" : "var(--danger)", border: dbStatus === "MySQL Connected" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)", fontWeight: 600 }}>
            Database: {dbStatus}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tab-nav">
        <button 
          className={`admin-tab-btn ${activeTab === "company" ? "active" : ""}`}
          onClick={() => setActiveTab("company")}
        >
          <Building2 size={16} /> Company Legal & Tax Registry
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === "admin" ? "active" : ""}`}
          onClick={() => setActiveTab("admin")}
        >
          <ShieldCheck size={16} /> Admin Profile & Password Security
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          <UserCheck size={16} /> Team Access & MySQL Users ({teamMembers.length})
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === "preferences" ? "active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <Sliders size={16} /> System & Warehouse Policies
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === "targets" ? "active" : ""}`}
          onClick={() => setActiveTab("targets")}
        >
          <Target size={16} /> Fiscal Sales Targets
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === "consistency" ? "active" : ""}`}
          onClick={() => setActiveTab("consistency")}
        >
          <CheckCheck size={16} /> Data Consistency Engine
        </button>
      </div>

      {/* TAB 1: COMPANY LEGAL REGISTRY */}
      {activeTab === "company" && (
        <form onSubmit={handleSaveCompany} className="workspace-card">
          <div className="workspace-card-title">
            <Building2 size={18} style={{ color: "var(--primary)" }} />
            Company Legal & Tax Profile
          </div>
          <p className="workspace-card-subtitle">
            Official business details applied to invoices, procurement orders, and GST returns.
          </p>

          <ValidationSummary errors={compErrors} />

          <div className="form-grid">
            <div className="form-group">
              <label>Legal Business Name <RequiredStar /></label>
              <input 
                className={`form-input ${compErrors.name ? "is-invalid" : ""}`} 
                value={compForm.name || ""} 
                onChange={(e) => {
                  setCompForm({ ...compForm, name: e.target.value });
                  if (compErrors.name) setCompErrors(prev => ({ ...prev, name: null }));
                }} 
              />
              <FieldError error={compErrors.name} />
            </div>

            <div className="form-group">
              <label>Business Tagline / Subtitle</label>
              <input 
                className="form-input" 
                value={compForm.tagline || ""} 
                onChange={(e) => setCompForm({ ...compForm, tagline: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Goods & Services Tax (GSTIN) <RequiredStar /></label>
              <input 
                className={`form-input uppercase ${compErrors.gstin ? "is-invalid" : ""}`} 
                value={compForm.gstin || ""} 
                maxLength={15}
                onChange={(e) => {
                  setCompForm({ ...compForm, gstin: e.target.value.toUpperCase() });
                  if (compErrors.gstin) setCompErrors(prev => ({ ...prev, gstin: null }));
                }} 
              />
              <FieldError error={compErrors.gstin} />
            </div>

            <div className="form-group">
              <label>Permanent Account Number (PAN) <RequiredStar /></label>
              <input 
                className={`form-input uppercase ${compErrors.pan ? "is-invalid" : ""}`} 
                value={compForm.pan || ""} 
                maxLength={10}
                onChange={(e) => {
                  setCompForm({ ...compForm, pan: e.target.value.toUpperCase() });
                  if (compErrors.pan) setCompErrors(prev => ({ ...prev, pan: null }));
                }} 
              />
              <FieldError error={compErrors.pan} />
            </div>

            <div className="form-group">
              <label>Official Contact Email <RequiredStar /></label>
              <input 
                type="email" 
                className={`form-input ${compErrors.email ? "is-invalid" : ""}`} 
                value={compForm.email || ""} 
                onChange={(e) => {
                  setCompForm({ ...compForm, email: e.target.value });
                  if (compErrors.email) setCompErrors(prev => ({ ...prev, email: null }));
                }} 
              />
              <FieldError error={compErrors.email} />
            </div>

            <div className="form-group">
              <label>Official Telephone / Mobile <RequiredStar /></label>
              <input 
                className={`form-input ${compErrors.phone ? "is-invalid" : ""}`} 
                value={compForm.phone || ""} 
                onChange={(e) => {
                  setCompForm({ ...compForm, phone: e.target.value });
                  if (compErrors.phone) setCompErrors(prev => ({ ...prev, phone: null }));
                }} 
              />
              <FieldError error={compErrors.phone} />
            </div>

            <div className="form-group full">
              <label>Registered Office Address <RequiredStar /></label>
              <textarea 
                rows={3} 
                className={`form-input ${compErrors.address ? "is-invalid" : ""}`} 
                value={compForm.address || ""} 
                onChange={(e) => {
                  setCompForm({ ...compForm, address: e.target.value });
                  if (compErrors.address) setCompErrors(prev => ({ ...prev, address: null }));
                }} 
              />
              <FieldError error={compErrors.address} />
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="primary">
              <Save size={16} /> Save Company Profile
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: ADMIN PROFILE & REAL MYSQL PASSWORD CHANGE */}
      {activeTab === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Section A: Display Name, Email & Phone */}
          <form onSubmit={handleSaveAdmin} className="workspace-card">
            <div className="workspace-card-title">
              <ShieldCheck size={18} style={{ color: "var(--primary)" }} />
              Administrator Identity & Contact (MySQL Database)
            </div>
            <p className="workspace-card-subtitle">
              Update your account credentials stored securely in MySQL database.
            </p>

            <ValidationSummary errors={profErrors} />

            <div className="form-grid">
              <div className="form-group">
                <label>Admin Display Name <RequiredStar /></label>
                <input 
                  className={`form-input ${profErrors.name ? "is-invalid" : ""}`} 
                  value={profForm.name || ""} 
                  onChange={(e) => {
                    setProfForm({ ...profForm, name: e.target.value });
                    if (profErrors.name) setProfErrors(prev => ({ ...prev, name: null }));
                  }} 
                />
                <FieldError error={profErrors.name} />
              </div>

              <div className="form-group">
                <label>Admin Email Address (Login ID) <RequiredStar /></label>
                <input 
                  type="email" 
                  className={`form-input ${profErrors.email ? "is-invalid" : ""}`} 
                  value={profForm.email || ""} 
                  onChange={(e) => {
                    setProfForm({ ...profForm, email: e.target.value });
                    if (profErrors.email) setProfErrors(prev => ({ ...prev, email: null }));
                  }} 
                />
                <FieldError error={profErrors.email} />
                <span className="form-help">This is your authenticated login username</span>
              </div>

              <div className="form-group">
                <label>Security & Emergency Mobile</label>
                <input 
                  className={`form-input ${profErrors.phone ? "is-invalid" : ""}`} 
                  value={profForm.phone || ""} 
                  onChange={(e) => {
                    setProfForm({ ...profForm, phone: e.target.value });
                    if (profErrors.phone) setProfErrors(prev => ({ ...prev, phone: null }));
                  }} 
                />
                <FieldError error={profErrors.phone} />
              </div>

              <div className="form-group">
                <label>Role</label>
                <input 
                  className="form-input" 
                  value={profForm.role || "Administrator"} 
                  disabled 
                  style={{ background: "var(--border-subtle)", opacity: 0.8 }}
                />
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="primary" disabled={isSavingProfile}>
                <Save size={16} /> {isSavingProfile ? "Saving to Database..." : "Save Admin Profile"}
              </button>
            </div>
          </form>

          {/* Section B: Change Password with Bcrypt in MySQL */}
          <form onSubmit={handleUpdatePassword} className="workspace-card" style={{ borderLeft: "4px solid var(--primary)" }}>
            <div className="workspace-card-title">
              <Lock size={18} style={{ color: "var(--primary)" }} />
              Change Administrator Password (Bcrypt Encrypted)
            </div>
            <p className="workspace-card-subtitle">
              Verify your current password to set a new password. The new password will be hashed with bcrypt and saved directly to MySQL database.
            </p>

            {passwordErrors.form && (
              <div className="validation-summary-alert" style={{ marginBottom: 16 }}>
                <AlertTriangle size={16} />
                <span>{passwordErrors.form}</span>
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label>Current Password <RequiredStar /></label>
                <div style={{ position: "relative" }}>
                  <input 
                    type={showPasswords ? "text" : "password"}
                    className={`form-input ${passwordErrors.currentPassword ? "is-invalid" : ""}`} 
                    value={passwordForm.currentPassword} 
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                      if (passwordErrors.currentPassword) setPasswordErrors(prev => ({ ...prev, currentPassword: null }));
                    }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPasswords(!showPasswords)} 
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                  >
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FieldError error={passwordErrors.currentPassword} />
              </div>

              <div className="form-group">
                <label>New Password <RequiredStar /></label>
                <div style={{ position: "relative" }}>
                  <input 
                    type={showPasswords ? "text" : "password"}
                    className={`form-input ${passwordErrors.newPassword ? "is-invalid" : ""}`} 
                    value={passwordForm.newPassword} 
                    placeholder="Minimum 6 characters"
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                      if (passwordErrors.newPassword) setPasswordErrors(prev => ({ ...prev, newPassword: null }));
                    }} 
                  />
                </div>
                <FieldError error={passwordErrors.newPassword} />
              </div>

              <div className="form-group">
                <label>Confirm New Password <RequiredStar /></label>
                <div style={{ position: "relative" }}>
                  <input 
                    type={showPasswords ? "text" : "password"}
                    className={`form-input ${passwordErrors.confirmPassword ? "is-invalid" : ""}`} 
                    value={passwordForm.confirmPassword} 
                    placeholder="Re-enter new password"
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                      if (passwordErrors.confirmPassword) setPasswordErrors(prev => ({ ...prev, confirmPassword: null }));
                    }} 
                  />
                </div>
                <FieldError error={passwordErrors.confirmPassword} />
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="primary" disabled={isUpdatingPassword}>
                <Lock size={16} /> {isUpdatingPassword ? "Encrypting & Saving..." : "Update Password in MySQL"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ROLES & TEAM ACCESS DIRECTLY FROM MYSQL */}
      {activeTab === "roles" && (
        <div className="workspace-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="workspace-card-title">
                <Key size={18} style={{ color: "var(--primary)" }} />
                MySQL Database Users & Team Members
              </div>
              <p className="workspace-card-subtitle" style={{ marginBottom: 0 }}>
                Real users with database access, bcrypt-hashed passwords, and JWT authorization.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="primary" onClick={() => setIsAddMemberOpen(true)} style={{ fontSize: "0.85rem", padding: "8px 14px" }}>
                <Plus size={15} /> Add Team Member
              </button>
            </div>
          </div>

          {/* Team Roster Table */}
          <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 24 }}>
            <table>
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Email Address</th>
                  <th>Assigned Role</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                      {isLoadingUsers ? "Loading users from MySQL..." : "No additional team members registered."}
                    </td>
                  </tr>
                ) : (
                  teamMembers.map((tm) => (
                    <tr key={tm.id}>
                      <td>
                        <div className="person">
                          <div className="mini-avatar">{tm.name ? tm.name[0] : "U"}</div>
                          <b>{tm.name}</b>
                        </div>
                      </td>
                      <td>{tm.email}</td>
                      <td>
                        <span className="role-tag">
                          <ShieldCheck size={12} /> {tm.role}
                        </span>
                      </td>
                      <td>{tm.designation || "Staff"}</td>
                      <td>
                        <span className="badge success">{tm.isActive ? "Active" : "Disabled"}</span>
                      </td>
                      <td>
                        <div className="row-actions">
<span style={{ fontSize: 11, color: "var(--text-muted)" }}>Protected</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM & WAREHOUSE PREFERENCES */}
      {activeTab === "preferences" && (
        <form onSubmit={handleSavePrefs} className="workspace-card">
          <div className="workspace-card-title">
            <Sliders size={18} style={{ color: "var(--primary)" }} />
            System & Warehouse Operating Policies
          </div>
          <p className="workspace-card-subtitle">
            Configure default billing parameters, stock threshold limits, and numbering sequences.
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label>Low Stock Replenishment Threshold (Units)</label>
              <input 
                type="number" 
                className="form-input" 
                value={prefsForm.minStockThreshold || 20} 
                onChange={(e) => setPrefsForm({ ...prefsForm, minStockThreshold: Number(e.target.value) })} 
              />
              <span className="form-help">Products falling below this quantity trigger dashboard restock alerts</span>
            </div>

            <div className="form-group">
              <label>Default Payment Terms</label>
              <select 
                className="form-input" 
                value={prefsForm.paymentTerms || "Net 30 Days"}
                onChange={(e) => setPrefsForm({ ...prefsForm, paymentTerms: e.target.value })}
              >
                <option value="Immediate">Immediate / Advance</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="Net 45 Days">Net 45 Days</option>
                <option value="Net 60 Days">Net 60 Days</option>
              </select>
            </div>

            <div className="form-group">
              <label>Sales Invoice Auto-Number Prefix</label>
              <input 
                className="form-input" 
                value={prefsForm.invoicePrefix || "LE-INV-"} 
                onChange={(e) => setPrefsForm({ ...prefsForm, invoicePrefix: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Default Dispatch Warehouse</label>
              <input 
                className="form-input" 
                value={prefsForm.dispatchWarehouse || "Central Warehouse - Bay A"} 
                onChange={(e) => setPrefsForm({ ...prefsForm, dispatchWarehouse: e.target.value })} 
              />
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="primary">
              <Save size={16} /> Save Operating Policies
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: FISCAL SALES TARGETS (MYSQL-BACKED) */}
      {activeTab === "targets" && (
        <div className="workspace-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="workspace-card-title">
                <Target size={18} style={{ color: "var(--primary)" }} />
                Fiscal Sales Targets & Quotas
              </div>
              <p className="workspace-card-subtitle">
                Configure quarterly revenue milestones stored in MySQL. Pacing, margin, and achievements are computed dynamically.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Fiscal Year:</label>
              <select
                className="form-input"
                style={{ width: "auto", fontWeight: 700 }}
                value={targetFy}
                onChange={(e) => setTargetFy(e.target.value)}
              >
                <option value="FY 2026-27">FY 2026-27 (Current)</option>
                <option value="FY 2025-26">FY 2025-26 (Previous)</option>
                <option value="FY 2027-28">FY 2027-28 (Future)</option>
              </select>
              <button
                type="button"
                className="outline"
                onClick={() => loadTargets(targetFy)}
                disabled={isLoadingTargets}
                title="Reload targets from database"
                style={{ padding: "6px 10px" }}
              >
                <RefreshCw size={14} style={{ animation: isLoadingTargets ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveTargets} style={{ marginTop: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {["Q1", "Q2", "Q3", "Q4"].map((qKey) => {
                const tgt = targetsList.find(t => t.quarter === qKey) || { quarter: qKey, targetAmount: 0, notes: "" };
                const prog = quarterlyProgress.find(p => p.quarter === qKey) || {};
                const qLabels = {
                  Q1: "Q1 (Apr - Jun)",
                  Q2: "Q2 (Jul - Sep)",
                  Q3: "Q3 (Oct - Dec)",
                  Q4: "Q4 (Jan - Mar)"
                };

                return (
                  <div
                    key={qKey}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 16,
                      background: "var(--bg-main, #f8fafc)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <strong style={{ fontSize: 14, color: "var(--text-main)" }}>{qLabels[qKey]}</strong>
                      <span
                        className="badge"
                        style={{
                          background:
                            prog.status === "Achieved" ? "rgba(16, 185, 129, 0.12)" :
                            prog.status === "Tracking" ? "rgba(0, 91, 181, 0.12)" :
                            prog.status === "Behind" ? "rgba(245, 158, 11, 0.12)" :
                            "rgba(148, 163, 184, 0.12)",
                          color:
                            prog.status === "Achieved" ? "#10b981" :
                            prog.status === "Tracking" ? "var(--primary)" :
                            prog.status === "Behind" ? "#d97706" :
                            "var(--text-muted)",
                          fontWeight: 700,
                          fontSize: 11
                        }}
                      >
                        {prog.status || "Not started"}
                      </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Target Amount (₹ INR)</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className="form-input"
                        value={tgt.targetAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setTargetsList(prev => {
                            const exists = prev.some(t => t.quarter === qKey);
                            if (exists) {
                              return prev.map(t => t.quarter === qKey ? { ...t, targetAmount: val } : t);
                            }
                            return [...prev, { quarter: qKey, targetAmount: val, notes: "" }];
                          });
                        }}
                      />
                      <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        Formatted: {formatIndianCurrency(tgt.targetAmount, { includeDecimals: false })}
                      </small>
                    </div>

                    <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Actual Invoiced:</span>
                        <strong style={{ color: "var(--text-main)" }}>{formatIndianCurrency(prog.actualRevenue || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Gross Margin:</span>
                        <span style={{ color: (prog.grossMarginPct ?? prog.netMargin) !== null ? "#10b981" : "var(--text-muted)", fontWeight: 600 }}>
                          {(prog.grossMarginPct ?? prog.netMargin) !== null && (prog.grossMarginPct ?? prog.netMargin) !== undefined ? formatPercent(prog.grossMarginPct ?? prog.netMargin) : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Progress:</span>
                        <strong style={{ color: "var(--text-main)" }}>
                          {prog.progressPercent !== null && prog.progressPercent !== undefined ? `${prog.progressPercent}%` : "0%"}
                        </strong>
                      </div>
                    </div>

                    <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(0, prog.progressPercent || 0))}%`,
                          background: prog.status === "Achieved" ? "#10b981" : "var(--primary)",
                          borderRadius: 3,
                          transition: "width 0.3s ease"
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="submit"
                className="primary"
                disabled={isSavingTargets}
              >
                <Save size={16} />
                {isSavingTargets ? "Saving to Database..." : `Save ${targetFy} Targets`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: DATA CONSISTENCY CHECK */}
      {activeTab === "consistency" && (
        <div className="workspace-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div className="workspace-card-title">
                <CheckCheck size={20} style={{ color: "var(--primary)" }} />
                Enterprise Data Consistency Verification Engine
              </div>
              <p className="workspace-card-subtitle">
                Automated 11-point mathematical reconciliation verifying ledger equilibrium across Sales, Revenue, Dashboard, Purchases, and Inventory.
              </p>
            </div>

            <button
              type="button"
              className="primary"
              onClick={loadConsistencyReport}
              disabled={isLoadingConsistency}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <RefreshCw size={15} className={isLoadingConsistency ? "spin-animation" : ""} />
              {isLoadingConsistency ? "Re-running Audit..." : "Re-run Consistency Check"}
            </button>
          </div>

          {/* Status summary banner */}
          {consistencyReport && (
            <div style={{
              marginTop: 18,
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              background: consistencyReport.allPassed ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: consistencyReport.allPassed ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {consistencyReport.allPassed ? (
                  <CheckCircle2 size={28} style={{ color: "#10b981" }} />
                ) : (
                  <XCircle size={28} style={{ color: "#ef4444" }} />
                )}
                <div>
                  <h4 style={{ margin: 0, color: consistencyReport.allPassed ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                    {consistencyReport.allPassed ? "ALL ${consistencyReport.totalChecks} CHECKS PASSED — 100% LEDGER CONSISTENCY" : `${consistencyReport.failedCount} CHECKS FAILED RECONCILIATION`}
                  </h4>
                  <small style={{ color: "var(--text-muted)" }}>
                    As of Anchor Date: ${consistencyReport.asOfDate || "01/11/2026"} (IST) | Fiscal Year: ${consistencyReport.fiscalYear || "FY"} | Source of Truth: MySQL Database
                  </small>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="badge success" style={{ fontSize: 13, padding: "6px 12px" }}>
                  {consistencyReport.passedCount} Passed
                </span>
                {consistencyReport.failedCount > 0 && (
                  <span className="badge danger" style={{ fontSize: 13, padding: "6px 12px" }}>
                    {consistencyReport.failedCount} Failed
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Consistency Checks Table */}
          <div style={{ marginTop: 20, overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th style={{ width: 220 }}>Check Name</th>
                  <th>Mathematical Rule / Definition</th>
                  <th style={{ width: 110, textAlign: "center" }}>Status</th>
                  <th style={{ width: 110, textAlign: "right" }}>Difference</th>
                  <th>Audit Verification Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingConsistency && !consistencyReport && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      <RefreshCw size={20} className="spin-animation" style={{ display: "inline-block", marginRight: 8 }} />
                      Executing mathematical consistency checks on live MySQL database...
                    </td>
                  </tr>
                )}

                {consistencyReport?.checks?.map((chk) => (
                  <tr key={chk.id}>
                    <td><strong>{chk.id}</strong></td>
                    <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{chk.name}</td>
                    <td style={{ fontSize: 13, color: "var(--text-muted)" }}>{chk.description}</td>
                    <td style={{ textAlign: "center" }}>
                      {chk.passed ? (
                        <span className="badge success" style={{ fontWeight: 700, padding: "4px 10px" }}>
                          ✓ PASS
                        </span>
                      ) : (
                        <span className="badge danger" style={{ fontWeight: 700, padding: "4px 10px" }}>
                          ✕ FAIL
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: chk.difference === 0 ? "#10b981" : "#ef4444" }}>
                      {chk.difference === 0 ? "0" : chk.difference.toFixed(2)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-main)" }}>
                      <code>{chk.details}</code>
                      {chk.expected !== undefined && chk.actual !== undefined && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                          Expected: <strong>{String(chk.expected)}</strong> | Actual: <strong>{String(chk.actual)}</strong>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD TEAM MEMBER MODAL */}
      {isAddMemberOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddMemberOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>
                <UserCheck size={18} /> Register Team Member in MySQL
              </h3>
              <button className="modal-close-btn" onClick={() => setIsAddMemberOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {memberErrors.form && (
                  <div className="validation-summary-alert">
                    <AlertTriangle size={15} />
                    <span>{memberErrors.form}</span>
                  </div>
                )}
                <div className="form-group">
                  <label>Full Name <RequiredStar /></label>
                  <input 
                    className={`form-input ${memberErrors.name ? "is-invalid" : ""}`}
                    value={newMemberForm.name} 
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })} 
                    placeholder="e.g. Ramesh Patil"
                  />
                  <FieldError error={memberErrors.name} />
                </div>
                <div className="form-group">
                  <label>Email Address (Login Username) <RequiredStar /></label>
                  <input 
                    type="email" 
                    className={`form-input ${memberErrors.email ? "is-invalid" : ""}`}
                    value={newMemberForm.email} 
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })} 
                    placeholder="user@laxmienterprises.com"
                  />
                  <FieldError error={memberErrors.email} />
                </div>
                <div className="form-group">
                  <label>Initial Password (Bcrypt Encrypted) <RequiredStar /></label>
                  <input 
                    type="password"
                    className={`form-input ${memberErrors.password ? "is-invalid" : ""}`}
                    value={newMemberForm.password} 
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, password: e.target.value })} 
                    placeholder="Minimum 6 characters"
                  />
                  <FieldError error={memberErrors.password} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select 
                    className="form-input" 
                    value={newMemberForm.role} 
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, role: e.target.value })}
                  >
                    <option value="sales">Commercial Sales & Billing</option>
                    <option value="manager">Warehouse & Inventory Manager</option>
                    <option value="accountant">Accounts & Financials</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Designation Title</label>
                  <input 
                    className="form-input" 
                    value={newMemberForm.designation} 
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, designation: e.target.value })} 
                    placeholder="e.g. Senior Billing Executive"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Create User in MySQL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
