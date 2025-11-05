import React from 'react';
import { X, BarChart, User, Clock, CheckCircle, Percent } from 'lucide-react';

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white p-4 rounded-lg shadow-md flex items-center">
    <div className={`p-3 rounded-full mr-4 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-800">{value}</p>
    </div>
  </div>
);

const ParentDashboard = ({ gameState, onClose }) => {
  const { studentInfo, statistics } = gameState;

  const totalProblems = statistics?.problemHistory ? Object.keys(statistics.problemHistory).length : 0;
  const totalAttempts = statistics?.answersTimeline ? statistics.answersTimeline.length : 0;
  const correctAttempts = statistics?.answersTimeline ? statistics.answersTimeline.filter(a => a.correct).length : 0;
  const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(1) : "0.0";

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all">
        <header className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <BarChart className="mr-3 text-indigo-500" />
            Parent Dashboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          >
            <X size={24} />
          </button>
        </header>

        <main className="p-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-indigo-200 flex items-center justify-center">
              <User size={32} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{studentInfo.name}</h3>
              <p className="text-sm text-gray-600">Progress Report</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              icon={<CheckCircle size={24} className="text-white" />}
              label="Total Problems Practiced"
              value={totalProblems}
              color="bg-green-500"
            />
            <StatCard
              icon={<Clock size={24} className="text-white" />}
              label="Total Attempts"
              value={totalAttempts}
              color="bg-blue-500"
            />
            <StatCard
              icon={<Percent size={24} className="text-white" />}
              label="Accuracy"
              value={`${accuracy}%`}
              color="bg-yellow-500"
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ParentDashboard;
