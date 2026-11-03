import React, { useState, useMemo, useEffect } from "react";
import {
  Users, Plus, Search, MessageCircle, MapPin, CheckCircle2, Send,
  Building2, Wheat, Milk, Tractor, Eye, X, Phone, Calendar
} from "lucide-react";
import ExpoLeadModal from "./ExpoLeadModal";
import ExpoLeadViewModal from "./ExpoLeadViewModal";
import WhatsAppBulkModal from "./WhatsAppBulkModal";
import MobileRecordCard from "./responsive/MobileRecordCard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveDataTable from "./responsive/ResponsiveDataTable";
import { createExpoLead, updateExpoLead } from "../services/expoApi";

// Field-name fallbacks
const getMobile = (l) => l.mobile || l.mobileNumber || l.phone || l.contact || "";
const getRemark = (l) => l.remark || l.note || l.notes || "";
const getDate = (l) => l.date || l.visitDate || l.createdAt || "";
const fmtDate = (d) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};

const theme = (cat) =>
  cat === "Dairy"
    ? { cls: "dairy", bg: "rgba(2, 132, 199, 0.12)", fg: "#0284c7", Icon: Milk, label: "Dairy" }
    : cat === "Farmers"
    ? { cls: "farmers", bg: "rgba(217, 119, 6, 0.12)", fg: "#d97706", Icon: Tractor, label: "Farmer" }
    : { cls: "feed-shop", bg: "rgba(16, 185, 129, 0.12)", fg: "#059669", Icon: Wheat, label: cat === "Animal Feed Shop" ? "Feed Shop" : "General" };

const statusClass = (s) =>
  s === "Converted" ? "success" : s === "Followed Up" || s === "Interested" ? "warning" : "muted";

export default function ExpoPage({
  expoLeads = [],
  onConvertToClient,
  company = {},
  showToast,
  onRefresh
}) {
  const [leads, setLeads] = useState(expoLeads || []);

  useEffect(() => {
    setLeads(expoLeads || []);
  }, [expoLeads]);

  useEffect(() => {
    if (onRefresh) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [eventFilter, setEventFilter] = useState("All");

  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [viewingLead, setViewingLead] = useState(null);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());

  const nextLeadId = useMemo(() => {
    let maxNum = 0;
    leads.forEach((l) => {
      const match = l.id && String(l.id).match(/\d+$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[0], 10));
    });
    return `EXP-${String(maxNum + 1).padStart(3, "0")}`;
  }, [leads]);

  const availableEvents = useMemo(() => {
    const set = new Set(leads.map((l) => l.expoName).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [leads]);

  const uniqueVillagesCount = useMemo(() => {
    return new Set(leads.map((l) => (l.village || "").toLowerCase().trim()).filter(Boolean)).size;
  }, [leads]);

  const followedUpCount = useMemo(
    () => leads.filter((l) => l.status === "Followed Up" || l.status === "Converted").length,
    [leads]
  );

  const count = (cat) => leads.filter((l) => l.category === cat).length;

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((lead) => {
      if (sectorFilter !== "All" && lead.category !== sectorFilter) return false;
      if (eventFilter !== "All" && lead.expoName !== eventFilter) return false;
      if (!q) return true;
      return [lead.name, lead.village, getMobile(lead), getRemark(lead), lead.expoName, lead.taluka, lead.district]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [leads, sectorFilter, eventFilter, search]);

  const handleOpenAdd = () => { setEditingLead(null); setLeadModalOpen(true); };
  const handleOpenEdit = (lead) => { setEditingLead(lead); setLeadModalOpen(true); };

  const handleSaveLead = async (data) => {
    if (editingLead) {
      const updated = await updateExpoLead(editingLead.id, data);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      if (showToast) showToast(`✓ Updated details for ${updated.name}`);
    } else {
      const created = await createExpoLead(data);
      setLeads((prev) => [created, ...prev]);
      if (showToast) showToast(`✓ Added Expo Lead: ${created.name} (${created.village})`);
    }
    if (onRefresh) onRefresh();
  };

  const handleStatusChange = async (leadId, newStatus) => {
    const before = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    setViewingLead((v) => (v && v.id === leadId ? { ...v, status: newStatus } : v));
    try {
      await updateExpoLead(leadId, { status: newStatus });
    } catch (err) {
      setLeads(before);
      setViewingLead((v) => (v && v.id === leadId ? before.find((l) => l.id === leadId) || v : v));
      if (showToast) showToast(`⚠ Could not update status: ${err.message}`);
    }
  };

  const handleBroadcastLogged = (updatedLeads = []) => {
    if (updatedLeads.length) {
      const byId = new Map(updatedLeads.map((l) => [l.id, l]));
      setLeads((prev) => prev.map((l) => byId.get(l.id) || l));
    }
    if (onRefresh) onRefresh();
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) setSelectedLeadIds(new Set());
    else setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
  };

  const toggleSelectLead = (id) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasFilters = sectorFilter !== "All" || eventFilter !== "All" || search.trim() !== "";

  return (
    <div className="page" style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h2 style={{ margin: "0 0 2px 0", fontSize: "1.25rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={17} />
            </span>
            Expo Visitors & WhatsApp Broadcast
          </h2>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)" }}>
            Agri expo visitor registry with 1-click WhatsApp follow-up campaigns
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="primary"
            onClick={() => setWhatsAppModalOpen(true)}
            style={{ background: "#25D366", borderColor: "#25D366", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          >
            <Send size={15} /> WhatsApp Bulk
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleOpenAdd}
            style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          >
            <Plus size={16} /> Add Visitor
          </button>
        </div>
      </div>

      {/* DUAL-RESPONSIVE KPI GRID: 4-cols on Laptop, 2-cols on Mobile */}
      <ResponsiveKpiGrid cols={4}>
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Visitors</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Users size={19} />
            </div>
          </div>
          <div className="stat-value">{leads.length}</div>
          <div className="trend positive"><span>Registered at stall</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Villages Covered</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <MapPin size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#10b981" }}>{uniqueVillagesCount}</div>
          <div className="trend positive"><span>Rural outreach</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>WhatsApp Follow-ups</span>
            <div className="stat-icon" style={{ background: "rgba(37, 211, 102, 0.15)", color: "#128C7E" }}>
              <MessageCircle size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#128C7E" }}>{followedUpCount}</div>
          <div className="trend positive">
            <span>{leads.length > 0 ? Math.round((followedUpCount / leads.length) * 100) : 0}% engagement</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Sectors Profiled</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
              <Building2 size={19} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <div>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Feed</small>
              <strong style={{ fontSize: "1.1rem", color: "#059669" }}>{count("Animal Feed Shop")}</strong>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Dairy</small>
              <strong style={{ fontSize: "1.1rem", color: "#0284c7" }}>{count("Dairy")}</strong>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Farmer</small>
              <strong style={{ fontSize: "1.1rem", color: "#d97706" }}>{count("Farmers")}</strong>
            </div>
          </div>
        </div>
      </ResponsiveKpiGrid>

      {/* TABLE CARD */}
      <div className="card table-card" style={{ maxWidth: "100%", overflow: "hidden" }}>
        <div className="card-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="filter-pills-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap", overflowX: "auto", maxWidth: "100%" }}>
            <button className={`filter-pill ${sectorFilter === "All" ? "active" : ""}`} onClick={() => setSectorFilter("All")}>
              All ({leads.length})
            </button>
            <button className={`filter-pill ${sectorFilter === "Animal Feed Shop" ? "active" : ""}`} onClick={() => setSectorFilter("Animal Feed Shop")} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Wheat size={13} style={{ color: "#059669" }} /> Feed Shop ({count("Animal Feed Shop")})
            </button>
            <button className={`filter-pill ${sectorFilter === "Dairy" ? "active" : ""}`} onClick={() => setSectorFilter("Dairy")} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Milk size={13} style={{ color: "#0284c7" }} /> Dairy ({count("Dairy")})
            </button>
            <button className={`filter-pill ${sectorFilter === "Farmers" ? "active" : ""}`} onClick={() => setSectorFilter("Farmers")} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Tractor size={13} style={{ color: "#d97706" }} /> Farmers ({count("Farmers")})
            </button>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="table-toolbar" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="local-search" style={{ flex: "1 1 260px", maxWidth: 420 }}>
            <Search size={16} />
            <input
              placeholder="Search name, village, mobile, note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="form-select"
            style={{ maxWidth: 240, fontSize: "0.82rem", padding: "8px 10px" }}
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            {availableEvents.map((ev) => (
              <option key={ev} value={ev}>{ev === "All" ? "All exhibitions" : ev}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSectorFilter("All"); setEventFilter("All"); }}
              style={{ border: "none", background: "transparent", color: "var(--danger)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <X size={13} /> Clear filters
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
            Showing {filteredLeads.length} of {leads.length} visitors
          </span>
        </div>

        {/* SELECTION BAR */}
        {selectedLeadIds.size > 0 && (
          <div style={{ background: "rgba(37, 211, 102, 0.12)", borderTop: "1px solid rgba(37, 211, 102, 0.3)", borderBottom: "1px solid rgba(37, 211, 102, 0.3)", padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#128C7E", display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={16} /> {selectedLeadIds.size} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="primary"
                onClick={() => setWhatsAppModalOpen(true)}
                style={{ background: "#25D366", borderColor: "#25D366", fontSize: "0.8rem", padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}
              >
                <Send size={14} /> Send WhatsApp to selected
              </button>
              <button
                type="button"
                className="outline"
                onClick={() => setSelectedLeadIds(new Set())}
                style={{ fontSize: "0.8rem", padding: "5px 10px" }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* DUAL-RESPONSIVE: Desktop Table vs Mobile Cards */}
        {filteredLeads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MessageCircle size={26} style={{ color: "#25D366" }} /></div>
            <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Expo Visitors Found</h4>
            <p style={{ fontSize: 13, marginBottom: 16 }}>
              {leads.length === 0
                ? "No expo visitors recorded yet."
                : "No visitors match your current search or filters."}
            </p>
            <button type="button" className="primary" onClick={handleOpenAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} /> Add Visitor
            </button>
          </div>
        ) : (
          <ResponsiveDataTable
            hasRecords={filteredLeads.length > 0}
            /* DESKTOP TABLE VIEW */
            desktopView={
              <div className="table-wrap">
                <table style={{ width: "100%", tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Visitor</th>
                      <th>Location & Contact</th>
                      <th>Inquiry Note</th>
                      <th>Event</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                      <th style={{ textAlign: "center", width: 70 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const t = theme(lead.category);
                      const isSelected = selectedLeadIds.has(lead.id);
                      const mobile = getMobile(lead);
                      const remark = getRemark(lead);
                      const place = [lead.taluka, lead.district].filter(Boolean).join(", ");

                      return (
                        <tr
                          key={lead.id}
                          style={{
                            background: isSelected ? "rgba(37, 211, 102, 0.04)" : "transparent",
                            cursor: "pointer"
                          }}
                          onClick={() => setViewingLead(lead)}
                        >
                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelectLead(lead.id)} />
                          </td>

                          <td>
                            <div className="person">
                              <div className="mini-avatar" style={{ background: t.bg, color: t.fg }}>
                                {(lead.name || "V")[0].toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <b
                                  style={{ color: "var(--text-main)", fontSize: 13, cursor: "pointer" }}
                                  onClick={() => setViewingLead(lead)}
                                  title="View visitor details"
                                >
                                  {lead.name}
                                </b>
                                <div style={{ marginTop: 3 }}>
                                  <span className={`client-type-badge ${t.cls}`} style={{ whiteSpace: "nowrap" }}>
                                    <t.Icon size={11} /> {t.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: "var(--text-main)" }}>
                                <MapPin size={12} style={{ color: "var(--primary)", flexShrink: 0 }} />
                                <span>{lead.village || "—"}</span>
                              </div>
                              {place && (
                                <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 17 }}>{place}</div>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, fontSize: 11.5, color: "var(--text-muted)" }}>
                                <Phone size={11} style={{ flexShrink: 0 }} /> <span>{mobile || "—"}</span>
                              </div>
                            </div>
                          </td>

                          <td style={{ maxWidth: 260 }}>
                            <div style={{
                              fontSize: 12, lineHeight: 1.4, color: remark ? "var(--text-main)" : "var(--text-muted)",
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
                            }} title={remark}>
                              {remark || "No note added"}
                            </div>
                          </td>

                          <td style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{lead.expoName || "—"}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(getDate(lead))}</div>
                          </td>

                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <span className={`badge ${statusClass(lead.status)}`}>{lead.status || "New Lead"}</span>
                          </td>

                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <div className="row-actions" style={{ justifyContent: "center" }}>
                              <button
                                type="button"
                                title={`View ${lead.name}`}
                                onClick={() => setViewingLead(lead)}
                                style={{ color: "var(--accent)", cursor: "pointer" }}
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }
            /* MOBILE RECORD CARDS VIEW */
            mobileView={
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px" }}>
                {filteredLeads.map((lead) => {
                  const t = theme(lead.category);
                  const mobile = getMobile(lead);
                  const remark = getRemark(lead);
                  const cleanPhone = mobile.replace(/\D/g, "");

                  return (
                    <MobileRecordCard
                      key={lead.id}
                      idBadge={lead.id}
                      title={lead.name}
                      subtitle={[lead.village, lead.taluka, lead.district].filter(Boolean).join(", ")}
                      categoryBadge={
                        <span style={{ color: t.fg, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <t.Icon size={12} /> {t.label}
                        </span>
                      }
                      statusBadge={
                        <span className={`badge ${statusClass(lead.status)}`} style={{ fontSize: 11 }}>
                          {lead.status || "New Lead"}
                        </span>
                      }
                      primaryMetrics={[
                        { label: "Mobile", value: mobile ? <a href={`tel:${mobile}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{mobile}</a> : "—" },
                        { label: "Event", value: lead.expoName || "Expo" },
                        { label: "Date", value: fmtDate(getDate(lead)) },
                      ]}
                      expandedDetails={
                        <div>
                          {remark && (
                            <div style={{ marginBottom: 6 }}>
                              <span className="mobile-record-detail-label">Inquiry Remark:</span>
                              <div style={{ fontSize: 12, marginTop: 2, color: "var(--text-main)" }}>{remark}</div>
                            </div>
                          )}
                          {lead.cattleCount && (
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Cattle Count</span>
                              <span className="mobile-record-detail-val">{lead.cattleCount} Animals</span>
                            </div>
                          )}
                        </div>
                      }
                      actions={
                        <>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/91${cleanPhone.slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="outline"
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#25D366" }}
                            >
                              <MessageCircle size={15} /> WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            className="primary"
                            onClick={() => setViewingLead(lead)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <Eye size={14} /> View Lead
                          </button>
                        </>
                      }
                    />
                  );
                })}
              </div>
            }
          />
        )}
      </div>

      {/* MODALS */}
      {leadModalOpen && (
        <ExpoLeadModal
          key={editingLead ? editingLead.id : "new-expo-lead"}
          onClose={() => { setLeadModalOpen(false); setEditingLead(null); }}
          onSave={handleSaveLead}
          leadToEdit={editingLead}
          nextId={nextLeadId}
          company={company}
        />
      )}

      <WhatsAppBulkModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        leads={selectedLeadIds.size > 0 ? leads.filter((l) => selectedLeadIds.has(l.id)) : leads}
        company={company}
        showToast={showToast}
        onSent={handleBroadcastLogged}
      />

      <ExpoLeadViewModal
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        lead={viewingLead}
        company={company}
        onEdit={(lead) => { setViewingLead(null); handleOpenEdit(lead); }}
        onStatusChange={handleStatusChange}
        onConvertToClient={onConvertToClient}
        showToast={showToast}
      />
    </div>
  );
}
