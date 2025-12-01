import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../common/Sidebar.jsx";
import Header from "../common/Header.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPlus,
  faUserPlus,
  faCopy,
  faChalkboardTeacher,
} from "@fortawesome/free-solid-svg-icons";
import TableSortHeader from '../common/TableSortHeader.jsx';
import { io } from "socket.io-client";
import { useToast } from "../common/ToastProvider.jsx";
import ConfirmationDialog from "../common/ConfirmationDialog.jsx";
import { SkeletonTable } from "../common/SkeletonLoader.jsx";
import EmptyState from "../common/EmptyState.jsx";
import apiClient from '../../services/apiClient.js';

  const socket = io(process.env.REACT_APP_API_BASE || "http://localhost:5000", {
  autoConnect: false,
});

const Modal = ({ show, onClose, title, children, actions }) => {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        zIndex: 1000,
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        animation: 'fadeIn 0.2s ease-out',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          padding: 24,
          borderRadius: 16,
          minWidth: 360,
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: 'scale(1)',
          transition: 'transform 0.2s ease',
          border: "1px solid rgba(15, 44, 99, 0.1)"
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.01)';
          e.currentTarget.style.boxShadow = "0 30px 80px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = "0 25px 70px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)";
        }}
      >
        {title && (
          <h2 style={{ 
            marginBottom: 18, 
            color: '#0f2c63', 
            fontSize: '22px', 
            fontWeight: '700'
          }}>
            {title}
          </h2>
        )}
        <div style={{ marginBottom: 18 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {actions}
        </div>
      </div>
    </div>
  );
};

const FacultyManagement = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'instructorId', direction: 'asc' });
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
    destructive: false,
  });

  // Add Instructor states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addDepartment, setAddDepartment] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Complete Registration states
  const [showCompleteRegModal, setShowCompleteRegModal] = useState(false);
  const [completeRegData, setCompleteRegData] = useState({
    email: "",
    firstname: "",
    lastname: "",
    contact: "",
    department: "",
    password: "",
  });
  const [completeRegLoading, setCompleteRegLoading] = useState(false);

  // Fetch instructors function
  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getInstructors();
      const data = res.data;

      // Normalize response: API may return an array or an object { success, instructors }
      if (Array.isArray(data)) {
        setInstructors(data);
      } else if (data && Array.isArray(data.instructors)) {
        setInstructors(data.instructors);
      } else if (data && Array.isArray(data.data)) {
        // Some older endpoints return { data: [...] }
        setInstructors(data.data);
      } else {
        // Fallback: empty array
        setInstructors([]);
      }
    } catch (err) {
      console.error('Error loading instructors', err);
      showToast('Error loading instructors.', 'error');
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initialize search from URL query (?q=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchQuery(q);
  }, []);

  useEffect(() => {
    fetchInstructors();

    socket.connect();

    socket.on("new-alert", (alertData) => {
      console.log("Received new alert via socket", alertData);
      fetchInstructors();
    });

    return () => {
      socket.off("new-alert");
      socket.disconnect();
    };
  }, [fetchInstructors]);

  const showConfirm = (title, message, onConfirm, destructive = false) =>
    setConfirmDialog({
      show: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog({ show: false, title: "", message: "", onConfirm: null });
      },
      destructive,
    });

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Instructor ID "${text}" copied to clipboard!`, 'success');
    } catch (err) {
      console.error('Failed to copy: ', err);
      showToast("Failed to copy instructor ID to clipboard", 'error');
    }
  };


  const handleSort = (key, direction) => {
    setSortConfig({ key, direction });
  };

  // Get unique departments for filter
  const departments = [...new Set(instructors.map(inst => inst.department).filter(Boolean))].sort();

  let filteredInstructors = instructors.filter((inst) => {
    if (activeTab === "active") return inst.status === "active";
    else if (activeTab === "pending") return inst.status === "pending";
    else if (activeTab === "archived") return inst.status === "archived";
    return true;
  });

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredInstructors = filteredInstructors.filter(inst =>
      (inst.firstname && inst.firstname.toLowerCase().includes(q)) ||
      (inst.lastname && inst.lastname.toLowerCase().includes(q)) ||
      (inst.email && inst.email.toLowerCase().includes(q)) ||
      (inst.instructorId && inst.instructorId.toLowerCase().includes(q)) ||
      (inst.department && inst.department.toLowerCase().includes(q)) ||
      (inst.contact && inst.contact.toLowerCase().includes(q))
    );
  }

  // Filter by department
  if (departmentFilter !== 'all') {
    filteredInstructors = filteredInstructors.filter(inst => inst.department === departmentFilter);
  }

  // Sort instructors
  filteredInstructors = [...filteredInstructors].sort((a, b) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Handle name sorting (combine firstname and lastname)
    if (sortConfig.key === 'name') {
      aValue = `${a.firstname || ''} ${a.lastname || ''}`.trim();
      bValue = `${b.firstname || ''} ${b.lastname || ''}`.trim();
    }

    // Handle string sorting
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = (bValue || '').toLowerCase();
    }

    // Handle null/undefined values
    if (!aValue && bValue) return 1;
    if (aValue && !bValue) return -1;
    if (!aValue && !bValue) return 0;

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const btnStyle = (bg) => ({
    padding: "8px 14px",
    backgroundColor: bg,
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: "600",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  });


  const handleArchive = (id) =>
    showConfirm("Archive Instructor", "Are you sure you want to archive this instructor?", async () => {
      try {
        const res = await apiClient.patch(`/api/instructors/${id}/archive`);
        if (res.data.success) {
          showToast('Instructor archived successfully.', 'success');
          fetchInstructors(); // Refresh the list to ensure consistency
        }
      } catch (err) {
        console.error('Error archiving instructor', err);
        showToast('Error archiving instructor.', 'error');
      }
    });

  const handleRestore = (id) =>
    showConfirm("Restore Instructor", "Restore this instructor to active?", async () => {
      try {
        const res = await apiClient.patch(`/api/instructors/${id}/restore`);
        if (res.data.success) {
          showToast('Instructor restored successfully.', 'success');
          fetchInstructors(); // Refresh the list to ensure consistency
        }
      } catch (err) {
        console.error('Error restoring instructor', err);
        showToast('Error restoring instructor.', 'error');
      }
    });


  const handleAddInstructor = (e) => {
    e.preventDefault();
    setAddLoading(true);

    apiClient.post("/api/registration/send-registration", {
      email: addEmail,
      department: addDepartment,
    })
      .then(async (res) => {
        const data = res.data;
        if (!data.success) {
          throw new Error(data.error || data.message || "Failed to send registration email");
        }
        return data;
      })
      .then((data) => {
        setShowAddModal(false);
        setAddEmail("");
        setAddDepartment("");
        const instructorIdMsg = data.instructorId ? ` (Instructor ID: ${data.instructorId})` : '';
        showToast(`Registration link sent successfully to ${addEmail}!${instructorIdMsg}`, 'success');
        fetchInstructors();
      })
      .catch((err) => {
        showToast(err.message || "Error sending registration email. Please try again.", 'error');
      })
      .finally(() => setAddLoading(false));
  };

  const handleCompleteRegChange = (e) => {
    setCompleteRegData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCompleteRegSubmit = async (e) => {
    e.preventDefault();
    setCompleteRegLoading(true);

    try {
      const response = await apiClient.post("/api/instructors/complete-registration", completeRegData);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Registration failed");
      }

      setShowCompleteRegModal(false);
      setCompleteRegData({
        email: "",
        firstname: "",
        lastname: "",
        contact: "",
        department: "",
        password: "",
      });
      
      // Show success message with instructor ID if available
      const instructorId = data.instructor?.id ? ` (Instructor ID: ${data.instructor.id})` : '';
      showToast(`Registration completed successfully!${instructorId}`, 'success');
      fetchInstructors();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCompleteRegLoading(false);
    }
  };



  return (
    <div className="dashboard-container" style={{ display: "flex", height: "100vh", background: '#fafafa' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <Header title="Faculty Management" />
        <div className="dashboard-content" style={{ marginTop: '140px', background: '#fafafa' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>Faculty Management</h2>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Manage instructors and faculty members efficiently</p>
          {/* Filters */}
          <div style={{
            background: '#ffffff',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            marginBottom: '20px',
            border: '1px solid rgba(15, 44, 99, 0.1)'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                style={{
                  padding: '10px 14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '180px',
                  background: '#fff',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  outline: 'none',
                  color: '#1e293b'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ 
              display: "flex", 
              gap: 8,
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}>
              <button
                onClick={() => setActiveTab("active")}
                style={{ 
                  ...btnStyle(activeTab === "active" ? "#059669" : "transparent"),
                  background: activeTab === "active" ? "#059669" : "transparent",
                  color: activeTab === "active" ? "#fff" : "#64748b",
                  transform: activeTab === "active" ? "scale(1.02)" : "scale(1)",
                  boxShadow: activeTab === "active" ? "0 4px 12px rgba(5, 150, 105, 0.2)" : "none",
                  fontWeight: activeTab === "active" ? "700" : "600"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "active") {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "active") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                Active ({instructors.filter(i => i.status === "active").length})
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                style={{ 
                  ...btnStyle(activeTab === "pending" ? "#d97706" : "transparent"),
                  background: activeTab === "pending" ? "#d97706" : "transparent",
                  color: activeTab === "pending" ? "#fff" : "#64748b",
                  transform: activeTab === "pending" ? "scale(1.02)" : "scale(1)",
                  boxShadow: activeTab === "pending" ? "0 4px 12px rgba(217, 119, 6, 0.2)" : "none",
                  fontWeight: activeTab === "pending" ? "700" : "600"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "pending") {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "pending") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                Pending ({instructors.filter(i => i.status === "pending").length})
              </button>
              <button
                onClick={() => setActiveTab("archived")}
                style={{ 
                  ...btnStyle(activeTab === "archived" ? "#b91c1c" : "transparent"),
                  background: activeTab === "archived" ? "#b91c1c" : "transparent",
                  color: activeTab === "archived" ? "#fff" : "#64748b",
                  transform: activeTab === "archived" ? "scale(1.02)" : "scale(1)",
                  boxShadow: activeTab === "archived" ? "0 4px 12px rgba(185, 28, 28, 0.2)" : "none",
                  fontWeight: activeTab === "archived" ? "700" : "600"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "archived") {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "archived") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                Archived ({instructors.filter(i => i.status === "archived").length})
              </button>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{
                  ...btnStyle("#2563eb"),
                  background: "#2563eb",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
                }}
                onClick={() => setShowAddModal(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.background = "#1d4ed8";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.background = "#2563eb";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.2)";
                }}
              >
                <FontAwesomeIcon icon={faPlus} /> Add Instructor
              </button>
            </div>
          </div>


          {loading ? (
            <div style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            }}>
              <SkeletonTable rows={5} cols={7} />
            </div>
          ) : filteredInstructors.length === 0 ? (
            <EmptyState
              icon={faUserPlus}
              title={`No ${activeTab} instructors`}
              message={
                activeTab === "active" 
                  ? "Get started by adding your first instructor to the system."
                  : activeTab === "pending"
                  ? "No instructors are currently pending registration."
                  : "No archived instructors found."
              }
              actionLabel={activeTab === "active" ? "Add Your First Instructor" : undefined}
              onAction={activeTab === "active" ? () => setShowAddModal(true) : undefined}
            />
          ) : (
            <div style={{ 
              overflowX: "auto", 
              borderRadius: "16px", 
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              background: "#fff",
              border: "1px solid rgba(15, 44, 99, 0.1)"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "16px", overflow: "hidden" }}>
                <thead style={{ 
                  background: "#0f2c63", 
                  color: "white",
                  boxShadow: "0 4px 12px rgba(15, 44, 99, 0.2)"
                }}>
                  <tr>
                    <TableSortHeader
                      sortKey="instructorId"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      style={{
                        padding: 12,
                        fontSize: 13,
                        fontWeight: "700",
                        whiteSpace: "nowrap",
                        background: sortConfig.key === 'instructorId' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        Instructor ID
                        <span style={{ 
                          fontSize: "10px", 
                          color: "#f97316", 
                          fontWeight: "500",
                          background: "rgba(249, 115, 22, 0.1)",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          Unique ID
                        </span>
                      </div>
                    </TableSortHeader>
                    <TableSortHeader
                      sortKey="name"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      style={{
                        padding: 12,
                        fontSize: 13,
                        fontWeight: "700",
                        whiteSpace: "nowrap",
                        background: sortConfig.key === 'name' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}
                    >
                      Name
                    </TableSortHeader>
                    <TableSortHeader
                      sortKey="email"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      style={{
                        padding: 12,
                        fontSize: 13,
                        fontWeight: "700",
                        whiteSpace: "nowrap",
                        background: sortConfig.key === 'email' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}
                    >
                      Email
                    </TableSortHeader>
                    <TableSortHeader
                      sortKey="contact"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      style={{
                        padding: 12,
                        fontSize: 13,
                        fontWeight: "700",
                        whiteSpace: "nowrap",
                        background: sortConfig.key === 'contact' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}
                    >
                      Contact Number
                    </TableSortHeader>
                    <TableSortHeader
                      sortKey="department"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      style={{
                        padding: 12,
                        fontSize: 13,
                        fontWeight: "700",
                        whiteSpace: "nowrap",
                        background: sortConfig.key === 'department' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}
                    >
                      Department
                    </TableSortHeader>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 13, fontWeight: "700", whiteSpace: "nowrap" }}>
                      Status
                    </th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 13, fontWeight: "700", whiteSpace: "nowrap" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstructors.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                        No instructors found in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredInstructors.map((inst, index) => (
                      <tr
                        key={inst._id}
                        style={{ 
                          borderBottom: "1px solid #f1f5f9", 
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          background: index % 2 === 0 ? "white" : "#fafafa",
                          cursor: "default",
                          animation: `fadeInUp 0.4s ease-out ${index * 0.03}s both`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f0f9ff";
                          e.currentTarget.style.transform = "scale(1.01)";
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 44, 99, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? "white" : "#fafafa";
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <td style={{ padding: 12, fontSize: 13, fontWeight: "600", color: "#0f2c63" }}>
                          {inst.instructorId && inst.instructorId.trim() !== "" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{
                                background: "#0f2c63",
                                color: "white",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "700",
                                letterSpacing: "0.5px",
                                display: "inline-block",
                                minWidth: "60px",
                                textAlign: "center"
                              }}>
                                ID-{inst.instructorId}
                              </span>
                              <button
                                onClick={() => copyToClipboard(inst.instructorId)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#6b7280",
                                  cursor: "pointer",
                                  padding: "4px",
                                  borderRadius: "4px",
                                  transition: "all 0.2s ease"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "#0f2c63";
                                  e.currentTarget.style.background = "#f3f4f6";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "#6b7280";
                                  e.currentTarget.style.background = "transparent";
                                }}
                                title="Copy Instructor ID"
                              >
                                <FontAwesomeIcon icon={faCopy} size="sm" />
                              </button>
                            </div>
                          ) : (
                            <span style={{ 
                              color: "#9ca3af", 
                              fontStyle: "italic",
                              fontSize: "12px"
                            }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 12, fontSize: 13, fontWeight: "600" }}>
                          {(inst.firstname && inst.lastname) ? `${inst.firstname} ${inst.lastname}` : inst.name || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Pending Registration</span>}
                        </td>
                        <td style={{ padding: 12, fontSize: 13 }}>{inst.email}</td>
                        <td style={{ padding: 12, fontSize: 13 }}>{inst.contact || <span style={{ color: "#9ca3af" }}>---</span>}</td>
                        <td style={{ padding: 12, fontSize: 13 }}>{inst.department || <span style={{ color: "#9ca3af" }}>---</span>}</td>
                        <td style={{ padding: 12 }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 5,
                              fontSize: 11,
                              fontWeight: "700",
                              textTransform: "uppercase",
                              background: inst.status === "active" ? "#dcfce7" : inst.status === "pending" ? "#fef3c7" : "#fee2e2",
                              color: inst.status === "active" ? "#16a34a" : inst.status === "pending" ? "#d97706" : "#dc2626",
                            }}
                          >
                            {inst.status}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {inst.status !== "archived" && (
                              <button
                                onClick={() => handleArchive(inst._id)}
                                style={{
                                  ...btnStyle("#dc2626"),
                                  background: "#dc2626",
                                  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.2)"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = "scale(1.08)";
                                  e.currentTarget.style.background = "#b91c1c";
                                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.3)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = "scale(1)";
                                  e.currentTarget.style.background = "#dc2626";
                                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(220, 38, 38, 0.2)";
                                }}
                              >
                                <FontAwesomeIcon icon={faTrash} /> Archive
                              </button>
                            )}
                            {inst.status === "archived" && (
                              <>
                                <button
                                  onClick={() => handleRestore(inst._id)}
                                  style={{
                                    ...btnStyle("#10b981"),
                                    background: "#10b981",
                                    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "scale(1.08)";
                                    e.currentTarget.style.background = "#059669";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.background = "#10b981";
                                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                                  }}
                                >
                                  <FontAwesomeIcon icon={faUserPlus} /> Restore
                                </button>
                              </>
                            )}
                            {inst.status !== "archived" && (
                              <button
                                onClick={() => {
                                  const url = `/admin/instructor/${inst._id}/workload`;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                style={{
                                  ...btnStyle("#2563eb"),
                                  background: "#2563eb",
                                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = "scale(1.08)";
                                  e.currentTarget.style.background = "#1d4ed8";
                                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.3)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = "scale(1)";
                                  e.currentTarget.style.background = "#2563eb";
                                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(37, 99, 235, 0.2)";
                                }}
                              >
                                <FontAwesomeIcon icon={faChalkboardTeacher} /> View Workload
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Instructor Modal */}
      <Modal
        show={showAddModal}
        onClose={() => !addLoading && setShowAddModal(false)}
        title="Add Instructor"
        actions={
          <>
            <button 
              onClick={() => setShowAddModal(false)} 
              style={{
                ...btnStyle("#6b7280"),
                background: "#6b7280",
                boxShadow: "0 4px 12px rgba(107, 114, 128, 0.2)"
              }} 
              disabled={addLoading}
              onMouseEnter={(e) => {
                if (!addLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = "#4b5563";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(107, 114, 128, 0.25)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "#6b7280";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(107, 114, 128, 0.2)";
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addInstructorForm"
              disabled={addLoading}
              style={{
                ...btnStyle("#2563eb"),
                background: "#2563eb",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
                opacity: addLoading ? 0.7 : 1,
                cursor: addLoading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!addLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = "#1d4ed8";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "#2563eb";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.2)";
              }}
            >
              {addLoading ? "Sending..." : "Send Registration Link"}
            </button>
          </>
        }
      >
        <form
          id="addInstructorForm"
          onSubmit={handleAddInstructor}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
            Enter the instructor's email and department. A registration link will be sent where they can complete their profile.
          </p>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontWeight: "600", fontSize: 13 }}>
              Instructor Email *
            </label>
            <input
              type="email"
              placeholder="instructor@buksu.edu.ph"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              required
              disabled={addLoading}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
                e.target.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                e.target.style.transform = "translateY(0)";
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontWeight: "600", fontSize: 13 }}>
              Department *
            </label>
            <input
              type="text"
              placeholder="e.g., Computer Science, Mathematics, Engineering"
              value={addDepartment}
              onChange={(e) => setAddDepartment(e.target.value)}
              required
              disabled={addLoading}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
                e.target.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                e.target.style.transform = "translateY(0)";
              }}
            />
          </div>
        </form>
      </Modal>

      {/* Complete Registration Modal */}
      <Modal
        show={showCompleteRegModal}
        onClose={() => !completeRegLoading && setShowCompleteRegModal(false)}
        title="Complete Instructor Registration"
        actions={
          <>
            <button 
              onClick={() => setShowCompleteRegModal(false)} 
              disabled={completeRegLoading} 
              style={{
                ...btnStyle("#6b7280"),
                background: "#6b7280",
                boxShadow: "0 4px 12px rgba(107, 114, 128, 0.2)"
              }}
              onMouseEnter={(e) => {
                if (!completeRegLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = "#4b5563";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(107, 114, 128, 0.25)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "#6b7280";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(107, 114, 128, 0.2)";
              }}
            >
              Cancel
            </button>
            <button
              form="completeRegForm"
              type="submit"
              disabled={completeRegLoading}
              style={{ 
                ...btnStyle("#10b981"), 
                background: "#10b981",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                opacity: completeRegLoading ? 0.7 : 1 
              }}
              onMouseEnter={(e) => {
                if (!completeRegLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = "#059669";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "#10b981";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              }}
            >
              {completeRegLoading ? "Completing..." : "Complete Registration"}
            </button>
          </>
        }
      >
        <form id="completeRegForm" onSubmit={handleCompleteRegSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {['email', 'firstname', 'lastname', 'contact', 'department', 'password'].map((field) => (
            <input
              key={field}
              type={field === 'email' ? 'email' : field === 'password' ? 'password' : 'text'}
              name={field}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
              value={completeRegData[field]}
              onChange={handleCompleteRegChange}
              required
              disabled={completeRegLoading}
              minLength={field === 'password' ? 6 : undefined}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
                e.target.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                e.target.style.transform = "translateY(0)";
              }}
            />
          ))}
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        show={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog({ show: false, title: "", message: "", onConfirm: null, destructive: false })}
        destructive={confirmDialog.destructive}
        confirmText={confirmDialog.destructive ? "Delete" : "Confirm"}
      />
    </div>
  );
};

export default FacultyManagement;
