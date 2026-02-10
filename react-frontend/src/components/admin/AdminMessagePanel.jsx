import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiBase = process.env.REACT_APP_API_BASE || '';

const AdminMessagePanel = () => {
  const [instructors, setInstructors] = useState([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const url = apiBase ? `${apiBase}/api/instructors` : '/api/instructors';
    setLoadingInstructors(true);
    axios.get(url)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.instructors || []);
        setInstructors(list);
      })
      .catch(() => setInstructors([]))
      .finally(() => setLoadingInstructors(false));
  }, []);

  const handleSend = async () => {
    if (!selectedInstructor || !message || !message.trim()) {
      setStatus('Please select an instructor and enter a message.');
      return;
    }
    setSending(true);
    setStatus('');
    try {
      const url = apiBase ? `${apiBase}/api/admin-message/send` : '/api/admin-message/send';
      await axios.post(url, {
        instructorId: selectedInstructor,
        adminId: null,
        message: message.trim()
      });
      setStatus('Message sent successfully!');
      setMessage('');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to send message.';
      setStatus(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-message-panel">
      <h3>Send Message to Instructor</h3>
      <select
        value={selectedInstructor}
        onChange={e => setSelectedInstructor(e.target.value)}
        disabled={loadingInstructors}
      >
        <option value="">{loadingInstructors ? 'Loading...' : 'Select Instructor'}</option>
        {instructors.map(inst => (
          <option key={inst._id || inst.id} value={inst._id || inst.id}>
            {(inst.firstname || '').trim()} {(inst.lastname || '').trim()} {inst.email ? `(${inst.email})` : ''}
          </option>
        ))}
      </select>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Type your message here..."
        rows={4}
        style={{ width: '100%', marginTop: '10px' }}
      />
      <button onClick={handleSend} disabled={sending} style={{ marginTop: '10px' }}>
        {sending ? 'Sending...' : 'Send Message'}
      </button>
      {status && <div style={{ marginTop: '10px', color: status.includes('success') ? 'green' : 'red' }}>{status}</div>}
    </div>
  );
};

export default AdminMessagePanel;
