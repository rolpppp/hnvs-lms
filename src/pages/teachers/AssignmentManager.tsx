// src/pages/teachers/AssignmentManager.tsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, AlertCircle, Save, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/AuthProvider';

interface AssignmentManagerProps {
  courseId?: string;
}

interface AssignmentRecord {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_by: string;
  created_at: string;
}

interface SubmissionRecord {
  id: string;
  assignment_id: string;
  student_id: string;
  text_answer: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    school_id: string | null;
  } | null;
}

export default function AssignmentManager({ courseId }: AssignmentManagerProps) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: courseId || '1', // Default to current course or dummy '1'
    dueDate: '',
  });
  const [gradingState, setGradingState] = useState<Record<string, { score: string; feedback: string }>>({});

  const loadAssignments = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId || formData.courseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading assignments:', error);
      return;
    }
    setAssignments(data || []);
  }, [courseId, formData.courseId, user]);

  useEffect(() => {
    // eslint-disable-next-line
    loadAssignments();
  }, [loadAssignments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase
      .from('assignments')
      .insert({
        course_id: courseId || formData.courseId,
        title: formData.title,
        description: formData.description,
        due_at: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        created_by: user.id,
      });

    if (error) {
      console.error('Error creating assignment:', error);
      return;
    }

    // Reset form
    setFormData({
      title: '',
      description: '',
      courseId: courseId || '1',
      dueDate: '',
    });
    setShowCreateForm(false);
    loadAssignments();
  };

  const formatDate = (timestamp?: number | string | null) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Use state to keep 'now' stable during render cycle and avoid impure function lint
  const [now] = useState(() => Date.now());

  const isOverdue = (deadline?: number | string | null) => {
    if (!deadline) return false;
    return now > new Date(deadline).getTime();
  };

  const loadSubmissions = async (assignmentId: string) => {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('*, profiles:student_id(full_name, school_id)')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading submissions:', error);
      return;
    }
    setSubmissions(data || []);
  };

  const handleOpenSubmissions = (assignmentId: string) => {
    setActiveAssignmentId(prev => (prev === assignmentId ? null : assignmentId));
    if (activeAssignmentId !== assignmentId) {
      loadSubmissions(assignmentId);
    }
  };

  const handleGrade = async (submissionId: string) => {
    if (!user) return;
    const grading = gradingState[submissionId];
    const scoreValue = grading?.score ? Number(grading.score) : null;

    const { error } = await supabase
      .from('assignment_submissions')
      .update({
        score: scoreValue,
        feedback: grading?.feedback || null,
        graded_by: user.id,
        graded_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) {
      console.error('Error grading submission:', error);
      return;
    }

    if (activeAssignmentId) {
      loadSubmissions(activeAssignmentId);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full pb-24">
      {/* Header - Only show if standalone */}
      {!courseId && (
        <div className="bg-blue-900 text-white p-6 mb-6">
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
      )}

      <div className={`max-w-4xl mx-auto ${courseId ? '' : 'p-4'} space-y-6`}>
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
                  {isOverdue(assignment.due_at) && (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                      <AlertCircle size={14} />
                      Overdue
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-blue-600" />
                    <div>
                      <p className="text-slate-500 text-xs">Due Date</p>
                      <p className="font-medium text-slate-900">
                        {formatDate(assignment.due_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  Created: {new Date(assignment.created_at).toLocaleDateString()}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenSubmissions(assignment.id)}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    {activeAssignmentId === assignment.id ? 'Hide Submissions' : 'View Submissions'}
                  </button>
                  <span className="text-xs text-slate-400">ID: {assignment.id.slice(0, 6)}</span>
                </div>

                {activeAssignmentId === assignment.id && (
                  <div className="mt-4 bg-slate-50 rounded-lg p-4 space-y-4">
                    {submissions.length === 0 ? (
                      <p className="text-sm text-slate-500">No submissions yet.</p>
                    ) : (
                      submissions.map((submission) => (
                        <div key={submission.id} className="bg-white rounded-lg p-4 border border-slate-200">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {submission.profiles?.full_name || 'Student'}
                                {submission.profiles?.school_id ? ` • ${submission.profiles.school_id}` : ''}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Submitted: {new Date(submission.created_at).toLocaleString()}
                              </p>
                            </div>
                            {submission.score !== null && (
                              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                                Score: {submission.score}
                              </span>
                            )}
                          </div>

                          {submission.text_answer && (
                            <div className="mt-3 text-sm text-slate-700 bg-slate-50 rounded p-3">
                              {submission.text_answer}
                            </div>
                          )}

                          {submission.file_path && (
                            <div className="mt-3">
                              <a
                                href={supabase.storage.from('course-content').getPublicUrl(submission.file_path).data.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline"
                              >
                                View Attachment {submission.file_name ? `(${submission.file_name})` : ''} <ExternalLink size={14} />
                              </a>
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                              type="number"
                              placeholder="Score"
                              value={gradingState[submission.id]?.score ?? ''}
                              onChange={(e) => setGradingState(prev => ({
                                ...prev,
                                [submission.id]: {
                                  score: e.target.value,
                                  feedback: prev[submission.id]?.feedback || '',
                                }
                              }))}
                              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Feedback (optional)"
                              value={gradingState[submission.id]?.feedback ?? ''}
                              onChange={(e) => setGradingState(prev => ({
                                ...prev,
                                [submission.id]: {
                                  score: prev[submission.id]?.score || '',
                                  feedback: e.target.value,
                                }
                              }))}
                              className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => handleGrade(submission.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                              Save Grade
                            </button>
                            {submission.feedback && (
                              <span className="text-xs text-slate-500">Current feedback: {submission.feedback}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
