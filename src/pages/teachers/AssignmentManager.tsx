// src/pages/teachers/AssignmentManager.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, Clock, AlertCircle, Save } from 'lucide-react';
import { db, type Assignment } from '../../lib/db';

export default function AssignmentManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '1',
    syncDeadline: '',
    dueDate: '',
  });

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    const allAssignments = await db.assignments.toArray();
    setAssignments(allAssignments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newAssignment: Assignment = {
      id: `assignment-${Date.now()}`,
      courseId: formData.courseId,
      title: formData.title,
      description: formData.description,
      createdAt: Date.now(),
      syncDeadline: formData.syncDeadline ? new Date(formData.syncDeadline).getTime() : undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate).getTime() : undefined,
      isPublished: true,
    };

    await db.assignments.add(newAssignment);
    
    // Reset form
    setFormData({
      title: '',
      description: '',
      courseId: '1',
      syncDeadline: '',
      dueDate: '',
    });
    setShowCreateForm(false);
    loadAssignments();
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (deadline?: number) => {
    if (!deadline) return false;
    return Date.now() > deadline;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-blue-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/teacher"
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Assignment Manager</h1>
          <p className="text-blue-100 text-sm">Set sync deadlines for offline students</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Create Button */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full bg-white border-2 border-dashed border-slate-300 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-blue-600 font-medium"
        >
          <Plus size={20} />
          Create New Assignment
        </button>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Assignment</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Module 1 Reflection Essay"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Assignment instructions..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Clock size={16} className="inline mr-1" />
                    Sync Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.syncDeadline}
                    onChange={(e) => setFormData({ ...formData, syncDeadline: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    When students should sync their work
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar size={16} className="inline mr-1" />
                    Final Due Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Actual submission deadline
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Create Assignment
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Assignment List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Active Assignments</h2>
          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-slate-400">
              <p>No assignments created yet</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{assignment.title}</h3>
                    <p className="text-slate-600 text-sm mt-1">{assignment.description}</p>
                  </div>
                  {isOverdue(assignment.syncDeadline) && (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                      <AlertCircle size={14} />
                      Overdue
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-yellow-600" />
                    <div>
                      <p className="text-slate-500 text-xs">Sync Deadline</p>
                      <p className="font-medium text-slate-900">
                        {formatDate(assignment.syncDeadline)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-blue-600" />
                    <div>
                      <p className="text-slate-500 text-xs">Due Date</p>
                      <p className="font-medium text-slate-900">
                        {formatDate(assignment.dueDate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  Created: {new Date(assignment.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
