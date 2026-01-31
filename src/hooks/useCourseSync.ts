import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useAuth } from '../features/auth/AuthProvider';

export function useCourseSync() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const syncCourses = useCallback(async () => {
        if (!navigator.onLine) return; // Can't sync if offline
        console.log('Syncing courses...');
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch ALL courses (public info)
            const { data: remoteCourses, error: courseError } = await supabase
                .from('courses')
                .select('id, code, title, description');

            if (courseError) throw courseError;

            if (remoteCourses) {
                // Bulk put (upsert) courses to local DB
                // We map to match our local Course interface
                const coursesToSave = remoteCourses.map(c => ({
                    id: c.id,
                    code: c.code,
                    title: c.title,
                    description: c.description || '',
                    isDownloaded: false, // Default state, strictly we should check if we have assets...
                    // Preserve existing isDownloaded state if exists?
                    // For now, let's just use put to update metadata but we need to handle isDownloaded
                }));

                // We need to be careful not to overwrite 'isDownloaded' if we already have it locally.
                await db.transaction('rw', db.courses, async () => {
                    for (const c of coursesToSave) {
                        const existing = await db.courses.get(c.id);
                        if (existing) {
                            // Update only metadata, keep local download state
                            await db.courses.update(c.id, {
                                code: c.code,
                                title: c.title,
                                description: c.description
                            });
                        } else {
                            await db.courses.add(c);
                        }
                    }
                });
            }

            // 2. Fetch Enrollments for current user
            if (user) {
                const { data: enrollments, error: enrollError } = await supabase
                    .from('enrollments')
                    .select('course_id, status, enrolled_at')
                    .eq('student_id', user.id);

                if (enrollError) throw enrollError;

                if (enrollments) {
                    await db.transaction('rw', db.enrollments, async () => {
                        for (const e of enrollments) {
                            await db.enrollments.put({
                                courseId: e.course_id,
                                studentId: user.id,
                                status: e.status as "active" | "inactive" | "blocked",
                                enrolledAt: new Date(e.enrolled_at).getTime(),
                            });
                        }
                    });
                }
            }

            console.log('Courses synced successfully');

        } catch (err: any) {
            console.error('Course sync failed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    return { syncCourses, loading, error };
}
