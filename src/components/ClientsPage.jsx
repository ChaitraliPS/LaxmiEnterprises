import React, { useState, useMemo } from "react";
import {
  Users, Plus, Search, Eye, X,
  Milk, Tractor, Wheat, Phone, Mail, MapPin,
  RotateCcw, CheckCircle2, Calendar
} from "lucide-react";
import ClientModal from "./ClientModal";
import ClientDetailsModal from "./ClientDetailsModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import InvoiceModal from "./InvoiceModal";
import ExportMenu from "./ExportMenu";
import { erpApi } from "../services/api";
import { downloadCSV } from "../utils/exportUtils";
import "./ClientsPage.css";

const CATEGORY_TABS = [
  { value: "All", label: "All clients", icon: Users },
  { value: "Animal Feed Shop", label: "Feed shops", icon: Wheat },
  { value: "Dairy", label: "Dairies", icon: Milk },
  { value: "Farmers", label: "Farmers", icon: Tractor },
];

const STATUS_OPTIONS = ["All", "Active", "Inactive"];
const TIER_OPTIONS = ["All", "Platinum", "Gold", "Silver", "Bronze"];

const getLocation = (c) =>
  [...new Set([c.village || c.city, c.taluka, c.district || c.city].filter(Boolean))].join(", ") || "-";

const typeTheme = (type) =>
  type === "Dairy"
    ? { cls: "dairy", label: "Dairy", bg: "rgba(2, 132, 199, 0.12)", fg: "#0284c7" }
    : type === "Farmers"
    ? { cls: "farmers", label: "Farmer", bg: "rgba(217, 119, 6, 0.12)", fg: "#d97706" }
    : { cls: "feed-shop", label: "Feed Shop", bg: "rgba(16, 185, 129, 0.12)", fg: "#059669" };

export default function ClientsPage({ 
  clients, 
  onSaveClients, 
  invoices = [], 
  onSaveInvoices, 
  onCreateInvoice,
  products = [],
  company = {} 
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [invoiceForClient, setInvoiceForClient] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const nextId = useMemo(() => {
    const ids = clients
      .map(c => {
        const match = c.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = ids.length ? Math.max(...ids) : 0;
    return `CL-${String(maxNum + 1).padStart(3, "0")}`;
  }, [clients]);

  const feedShopCount = useMemo(() => clients.filter(c => c.clientType === "Animal Feed Shop").length, [clients]);
  const dairyCount = useMemo(() => clients.filter(c => c.clientType === "Dairy").length, [clients]);
  const farmersCount = useMemo(() => clients.filter(c => c.clientType === "Farmers").length, [clients]);

  const categoryCounts = {
    All: clients.length,
    "Animal Feed Shop": feedShopCount,
    Dairy: dairyCount,
    Farmers: farmersCount,
  };

  const hasActiveFilters =
    categoryFilter !== "All" || statusFilter !== "All" || tierFilter !== "All" || search.trim() !== "";

  const handleClearFilters = () => {
    setCategoryFilter("All");
    setStatusFilter("All");
    setTierFilter("All");
    setSearch("");
  };

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchesCategory = categoryFilter === "All" || c.clientType === categoryFilter;
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      const matchesTier = tierFilter === "All" || (c.tier || "Gold") === tierFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q)) ||
        (c.clientType && c.clientType.toLowerCase().includes(q)) ||
        (c.village && c.village.toLowerCase().includes(q)) ||
        (c.taluka && c.taluka.toLowerCase().includes(q)) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.contact && c.contact.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.productTypes && c.productTypes.toLowerCase().includes(q)) ||
        (c.companies && c.companies.toLowerCase().includes(q)) ||
        (c.brands && c.brands.toLowerCase().includes(q)) ||
        (c.animalDetails && c.animalDetails.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q))
      );
      return matchesCategory && matchesStatus && matchesTier && matchesSearch;
    });
  }, [clients, search, categoryFilter, statusFilter, tierFilter]);

  const handleOpenAdd = (defaultType = "Animal Feed Shop") => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleSaveClient = (clientData) => {
    if (editingClient) {
      const updated = clients.map(c => c.id === editingClient.id ? clientData : c);
      onSaveClients(updated);
      showToast(`✓ Updated ${clientData.name} details successfully!`);
    } else {
      const exists = clients.some(c => c.id.toLowerCase() === clientData.id.toLowerCase());
      if (exists) {
        showToast(`⚠️ A client with ID ${clientData.id} already exists.`);
        return;
      }
      const updated = [clientData, ...clients];
      onSaveClients(updated);
      showToast(`✓ Added ${clientData.name} (${clientData.clientType}) to directory!`);
    }
    setModalOpen(false);
    setEditingClient(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingClient) return;
    const updated = clients.filter(c => c.id !== deletingClient.id);
    onSaveClients(updated);
    showToast(`✓ Client ${deletingClient.name} deleted.`);
    setDeletingClient(null);
  };

  const handleRefreshDb = () => {
    erpApi.getAllData().then(res => {
      if (res.data?.clients) {
        onSaveClients(res.data.clients);
        showToast("✓ Refreshed live clients from MySQL database!");
      }
    }).catch(err => {
      showToast("⚠️ Refresh notice: " + err.message);
    });
  };

  const handleExportCSV = () => {
    const headers = [
      "Client ID", "Category / Type", "Client Name", "Village (गाव)", "Taluka (तालुका)",
      "District (जिल्हा)", "Contact Number", "Email", "Date of Birth (DOB)", "Animal Feed - Products",
      "Animal Feed - Companies", "Animal Feed - Brands", "Dairy - Suppliers Count", "Dairy - Milk Quantity",
      "Farmers - Animals Count", "Farmers - Animal Details", "Tier", "Payment Terms", "Orders",
      "Revenue_INR", "Outstanding_INR", "Status"
    ];
    const rows = filtered.map(c => [
      `"${c.id}"`,
      `"${c.clientType || 'Animal Feed Shop'}"`,
      `"${c.name}"`,
      `"${c.village || ''}"`,
      `"${c.taluka || ''}"`,
      `"${c.district || c.city || ''}"`,
      `"${c.contact}"`,
      `"${c.email || ''}"`,
      `"${c.dob || ''}"`,
      `"${c.productTypes || ''}"`,
      `"${c.companies || ''}"`,
      `"${c.brands || ''}"`,
      c.numberOfSuppliers || '',
      `"${c.milkQuantity || ''}"`,
      c.numberOfAnimals || '',
      `"${c.animalDetails || ''}"`,
      `"${c.tier || 'Gold'}"`,
      `"${c.paymentTerms || 'Net 30'}"`,
      c.orders,
      c.revenue,
      c.outstanding || 0,
      `"${c.status}"`
    ]);
    downloadCSV(`laxmi_enterprises_clients_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast("✓ Exported clients directory spreadsheet.");
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* Header: category tabs (left) + primary actions (right) */}
      <div className="cl-header">
        <div className="cl-tabs" role="tablist" aria-label="Client category">
          {CATEGORY_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={categoryFilter === value}
              className={`cl-tab ${categoryFilter === value ? "active" : ""}`}
              onClick={() => setCategoryFilter(value)}
            >
              <Icon size={15} />
              <span>{label}</span>
              <span className="cl-tab-count">{categoryCounts[value]}</span>
            </button>
          ))}
        </div>

        <div className="cl-actions">
          <button
            type="button"
            className="outline"
            onClick={handleRefreshDb}
            title="Refresh live clients from MySQL database"
          >
            <RotateCcw size={14} /> Refresh
          </button>
          <ExportMenu
            label="Export"
            category="Clients"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />
          <button
            type="button"
            className="primary"
            onClick={() => handleOpenAdd(categoryFilter !== "All" ? categoryFilter : "Animal Feed Shop")}
          >
            <Plus size={16} /> Add client
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card table-card">
        <div className="table-toolbar cl-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Search name, village, taluka, contact, brand..."
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

          <label className="cl-select">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map(st => (
                <option key={st} value={st}>
                  {st === "All" ? "All statuses" : `${st} (${clients.filter(c => c.status === st).length})`}
                </option>
              ))}
            </select>
          </label>

          <label className="cl-select">
            <span>Tier</span>
            <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
              {TIER_OPTIONS.map(t => (
                <option key={t} value={t}>{t === "All" ? "All tiers" : t}</option>
              ))}
            </select>
          </label>

          {hasActiveFilters && (
            <button type="button" className="cl-clear" onClick={handleClearFilters}>
              <X size={13} /> Clear filters
            </button>
          )}

          <span className="cl-count">
            Showing {filtered.length} of {clients.length} clients
          </span>
        </div>

        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={26} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Clients Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16 }}>
                {clients.length === 0 
                  ? "Your client directory currently has 0 records. Add your first client account or refresh from live MySQL database."
                  : "No client records match your current search query or filter selection."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {clients.length === 0 && (
                  <button className="primary" onClick={handleRefreshDb}>
                    <RotateCcw size={15} /> Refresh Live Database
                  </button>
                )}
                <button className="outline" onClick={() => handleOpenAdd(categoryFilter !== "All" ? categoryFilter : "Animal Feed Shop")}><Plus size={15} /> Add New Client</button>
              </div>
            </div>
          ) : (
            <table className="cl-table">
              <colgroup>
                <col style={{ width: "27%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact & location</th>
                  <th>Business details</th>
                  <th>Billing</th>
                  <th>Status & actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const theme = typeTheme(c.clientType);
                  const due = Number(c.outstanding) || 0;
                  return (
                    <tr key={c.id}>
                      {/* 1. Client identity */}
                      <td>
                        <div className="cl-client">
                          <div className="mini-avatar" style={{ background: theme.bg, color: theme.fg }}>
                            {c.name ? c.name[0] : "C"}
                          </div>
                          <div className="cl-client-main">
                            <b
                              className="cl-name"
                              onClick={() => setViewingClient(c)}
                              title="View full client profile"
                            >
                              {c.name}
                            </b>
                            <div className="cl-meta">
                              <code>{c.id}</code>
                              <span className={`client-type-badge ${theme.cls}`}>
                                {c.clientType === "Dairy" ? <Milk size={11} /> :
                                 c.clientType === "Farmers" ? <Tractor size={11} /> :
                                 <Wheat size={11} />}
                                {theme.label}
                              </span>
                            </div>
                            {c.contactPerson && <div className="cl-sub">Prop: {c.contactPerson}</div>}
                            {c.dob && (
                              <div className="cl-sub"><Calendar size={11} /> DOB: {c.dob}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact + location */}
                      <td>
                        <div className="cl-stack">
                          <a href={`tel:${c.contact}`} className="cl-link">
                            <Phone size={12} /> {c.contact}
                          </a>
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="cl-link muted">
                              <Mail size={12} /> <span className="cl-email">{c.email}</span>
                            </a>
                          )}
                          <div className="cl-link muted">
                            <MapPin size={12} /> <span>{getLocation(c)}</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Business details (depends on client type) */}
                      <td>
                        {c.clientType === "Animal Feed Shop" && (
                          <div className="cl-stack small">
                            {c.productTypes && (
                              <div><span className="cl-label">Products</span> {c.productTypes.length > 36 ? `${c.productTypes.slice(0, 36)}...` : c.productTypes}</div>
                            )}
                            {c.brands && (
                              <div><span className="cl-label">Brands</span> {c.brands.length > 30 ? `${c.brands.slice(0, 30)}...` : c.brands}</div>
                            )}
                            {c.numberOfAnimals && (
                              <div style={{ color: "#059669", fontWeight: 600 }}>🐾 {c.numberOfAnimals}</div>
                            )}
                          </div>
                        )}
                        {c.clientType === "Dairy" && (
                          <div className="cl-stack small">
                            <div style={{ color: "#0284c7", fontWeight: 700 }}>🥛 {c.numberOfSuppliers || 0} suppliers</div>
                            <div><span className="cl-label">Milk qty</span> <b>{c.milkQuantity || "-"}</b></div>
                          </div>
                        )}
                        {c.clientType === "Farmers" && (
                          <div className="cl-stack small">
                            <div style={{ color: "#d97706", fontWeight: 700 }}>🚜 {c.numberOfAnimals || 0} animals</div>
                            {c.animalDetails && (
                              <div className="cl-sub">{c.animalDetails.length > 32 ? `${c.animalDetails.slice(0, 32)}...` : c.animalDetails}</div>
                            )}
                          </div>
                        )}
                        {!c.clientType && <span className="cl-sub">General account</span>}
                      </td>

                      {/* 4. Billing */}
                      <td>
                        <div className="cl-money">₹{Number(c.revenue || 0).toLocaleString("en-IN")}</div>
                        <div className="cl-sub">{c.orders || 0} orders • {c.paymentTerms || "Net 30"}</div>
                        <div className={`cl-due ${due > 0 ? "has-due" : ""}`}>
                          {due > 0 ? `₹${due.toLocaleString("en-IN")} due` : "No dues"}
                        </div>
                      </td>

                      {/* 5. Status + View only */}
                      <td>
                        <div className="cl-status-actions">
                          <span className={`badge ${c.status === "Active" ? "success" : "muted"}`}>
                            <span
                              className={`badge-dot ${c.status === "Active" ? "pulse" : ""}`}
                              style={{
                                background: c.status === "Active" ? "#10b981" : "#94a3b8",
                                width: 6, height: 6, borderRadius: "50%",
                                display: "inline-block", marginRight: 6
                              }}
                            />
                            {c.status}
                          </span>
                          <div className="row-actions">
                            <button title={`View full profile of ${c.name}`} onClick={() => setViewingClient(c)} style={{ color: "var(--accent)" }}>
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ClientModal
        key={editingClient ? editingClient.id : "new-client"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingClient(null); }}
        onSave={handleSaveClient}
        clientToEdit={editingClient}
        nextId={nextId}
        existingIds={clients.map(c => c.id)}
      />

      <ClientDetailsModal
        isOpen={!!viewingClient}
        onClose={() => setViewingClient(null)}
        client={viewingClient}
        onEdit={(c) => { setViewingClient(null); handleOpenEdit(c); }}
        onCreateInvoice={(c) => { setViewingClient(null); setInvoiceForClient(c); }}
        onDelete={(c) => {
          setViewingClient(null);
          setDeletingClient(c);
        }}
      />

      <DeleteConfirmModal
        isOpen={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Account Deletion"
        message={deletingClient ? `Are you sure you want to remove ${deletingClient.name} (${deletingClient.id}) from the client directory?` : ""}
        details={deletingClient ? `This account has ${deletingClient.orders} orders and ₹${Number(deletingClient.revenue).toLocaleString("en-IN")} in recorded revenue.` : ""}
      />

      {invoiceForClient && (
        <InvoiceModal
          isOpen={!!invoiceForClient}
          onClose={() => setInvoiceForClient(null)}
          onSave={(newInv) => {
            if (onCreateInvoice) {
              onCreateInvoice(newInv);
            } else if (onSaveInvoices) {
              onSaveInvoices([newInv, ...(invoices || [])]);
            }
            showToast(`✓ Created and issued Invoice ${newInv.id} for ${invoiceForClient.name}`);
            setInvoiceForClient(null);
          }}
          clients={clients}
          products={products}
          nextId={`LE-INV-2026-${String((invoices?.length || 0) + 1).padStart(3, "0")}`}
          company={company}
          defaultClient={invoiceForClient}
          showToast={showToast}
        />
      )}
    </div>
  );
}