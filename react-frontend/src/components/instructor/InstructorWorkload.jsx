import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import '../../styles/InstructorWorkload.css';

const InstructorWorkload = () => {
  const { instructorId } = useParams();
  const [workloadData, setWorkloadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkloadData = async () => {
      try {
        const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
        const response = await fetch(`${apiBase}/api/instructors/${instructorId}/workload`);
        if (!response.ok) {
          throw new Error('Failed to fetch workload data');
        }
        const data = await response.json();
        setWorkloadData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkloadData();
  }, [instructorId]);

  if (loading) {
    return <div className="loading">Loading workload data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!workloadData) {
    return <div className="no-data">No workload data available</div>;
  }

  const { weeklySummary, dailyBreakdown } = workloadData;

  const barChartData = {
    labels: dailyBreakdown.map((day) => day.day),
    datasets: [
      {
        label: 'Hours per Day',
        data: dailyBreakdown.map((day) => day.hours),
        backgroundColor: '#2563eb',
      },
    ],
  };

  const pieChartData = {
    labels: ['Classes', 'Free Time'],
    datasets: [
      {
        data: [weeklySummary.totalClasses, 7 - weeklySummary.totalClasses],
        backgroundColor: ['#10b981', '#f97316'],
      },
    ],
  };

  return (
    <div className="workload-container">
      <header className="workload-header">
        <h1>Instructor Workload</h1>
        <p>Overview of workload for Instructor ID: {instructorId}</p>
      </header>

      <section className="workload-summary">
        <div className="summary-card">
          <h2>Total Classes</h2>
          <p>{weeklySummary.totalClasses}</p>
        </div>
        <div className="summary-card">
          <h2>Total Hours</h2>
          <p>{weeklySummary.totalHours} hrs</p>
        </div>
        <div className="summary-card">
          <h2>Busiest Day</h2>
          <p>{weeklySummary.busiestDay}</p>
        </div>
      </section>

      <section className="charts">
        <div className="chart">
          <h2>Daily Breakdown</h2>
          <Bar data={barChartData} />
        </div>
        <div className="chart">
          <h2>Weekly Overview</h2>
          <Pie data={pieChartData} />
        </div>
      </section>
    </div>
  );
};

export default InstructorWorkload;