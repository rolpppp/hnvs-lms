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
                const coursesToSave = remoteCourses.map(c => ({
                    id: c.id,
                    code: c.code,
                    title: c.title,
                    description: c.description || '',
                    isDownloaded: false,
                }));

                await db.transaction('rw', db.courses, async () => {
                    for (const c of coursesToSave) {
                        const existing = await db.courses.get(c.id);
                        if (existing) {
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

                // ----------------------------------------------------
                // 1b. Fetch LESSONS for these courses (Metadata Sync)
                // ----------------------------------------------------
                const courseIds = remoteCourses.map(c => c.id);
                if (courseIds.length > 0) {
                    const { data: lessonsData, error: lessonError } = await supabase
                        .from('lessons')
                        .select(`
                            id, 
                            course_id, 
                            title, 
                            type, 
                            order, 
                            duration_minutes, 
                            content_html, 
                            is_visible,
                            quiz_id,
                            lesson_assets(id, kind, storage_path, mime_type)
                        `)
                        .in('course_id', courseIds);
                    // .eq('is_visible', true); // Removed to sync all and filter locally
                    // Let's sync visible for now to respect teacher settings

                    if (lessonError) {
                        console.error('Error fetching lessons:', lessonError);
                    } else if (lessonsData) {
                        // Map to local Lesson interface
                        const localLessons = lessonsData.map((l: any) => {
                            const asset = l.lesson_assets?.[0]; // Assuming 1 asset per lesson for now
                            return {
                                id: l.id,
                                courseId: l.course_id,
                                title: l.title,
                                description: '', // Schema doesn't have desc yet, use title or empty
                                type: l.type,
                                order: l.order,
                                duration: l.duration_minutes || 0,
                                content: l.content_html || '',
                                isVisible: l.is_visible,
                                quizId: l.quiz_id,
                                // Map assets
                                storage_path: asset?.storage_path,
                                videoUrl: (l.type === 'video' && asset) ? asset.storage_path : undefined,
                                pdfUrl: (l.type === 'pdf' && asset) ? asset.storage_path : undefined,
                            };
                        });

                        await db.transaction('rw', db.lessons, async () => {
                            await db.lessons.bulkPut(localLessons);
                        });
                        console.log(`Synced ${localLessons.length} lessons.`);
                    }
                }
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
