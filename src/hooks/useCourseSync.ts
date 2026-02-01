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
            if (!user) throw new Error("User not authenticated");

            // 1. Determine Visible Courses
            // A. Fetch courses created by me
            const { data: myCourses, error: myError } = await supabase
                .from('courses')
                .select('id, code, title, description')
                .eq('created_by', user.id);

            if (myError) throw myError;

            // B. Fetch enrollments to find other courses
            const { data: myEnrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('course_id')
                .eq('student_id', user.id);

            if (enrollError) throw enrollError;

            const enrolledCourseIds = myEnrollments?.map(e => e.course_id) || [];

            // C. Fetch enrolled courses (if any)
            let enrolledCourses: any[] = [];
            if (enrolledCourseIds.length > 0) {
                const { data, error } = await supabase
                    .from('courses')
                    .select('id, code, title, description')
                    .in('id', enrolledCourseIds);
                if (error) throw error;
                enrolledCourses = data || [];
            }

            // D. Merge lists (Handle duplicates if looking at own course as student)
            const allVisibleCourses = [...(myCourses || []), ...enrolledCourses];
            // Remove duplicates by ID
            const remoteCourses = Array.from(new Map(allVisibleCourses.map(c => [c.id, c])).values());
            const courseIds = remoteCourses.map(c => c.id);

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
                // const courseIds = remoteCourses.map(c => c.id); // Moved up
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

                // ----------------------------------------------------
                // 1c. Fetch QUIZZES (Content Sync)
                // ----------------------------------------------------
                if (courseIds.length > 0) {
                    // Fetch Quizzes
                    const { data: quizzesData, error: quizError } = await supabase
                        .from('quizzes')
                        .select('id, course_id, title, published, allowed_attempts')
                        .in('course_id', courseIds)
                        .eq('published', true); // Only sync published quizzes

                    if (quizError) console.error('Error fetching quizzes:', quizError);

                    if (quizzesData && quizzesData.length > 0) {
                        const quizIds = quizzesData.map(q => q.id);

                        // Fetch Questions
                        const { data: questionsData, error: qError } = await supabase
                            .from('quiz_questions')
                            .select('id, quiz_id, prompt, order')
                            .in('quiz_id', quizIds)
                            .order('order');

                        if (qError) console.error('Error fetching questions:', qError);

                        // Fetch Options
                        const questionIds = questionsData?.map(q => q.id) || [];
                        const { data: optionsData, error: oError } = await supabase
                            .from('quiz_options')
                            .select('id, question_id, label, is_correct')
                            .in('question_id', questionIds);

                        if (oError) console.error('Error fetching options:', oError);

                        // Construct Local Quiz Objects (Denormalized)
                        const localQuizzes = quizzesData.map(q => {
                            const qs = questionsData?.filter(quest => quest.quiz_id === q.id) || [];
                            return {
                                id: q.id,
                                courseId: q.course_id,
                                title: q.title,
                                allowedAttempts: q.allowed_attempts || 1, // Default to 1 if missing
                                questions: qs.map(quest => {
                                    const opts = optionsData?.filter(opt => opt.question_id === quest.id) || [];
                                    const correctOpt = opts.findIndex(o => o.is_correct);
                                    return {
                                        id: quest.id,
                                        text: quest.prompt,
                                        options: opts.map(o => o.label),
                                        correctOption: correctOpt >= 0 ? correctOpt : 0
                                    };
                                })
                            };
                        });

                        await db.transaction('rw', db.quizzes, async () => {
                            await db.quizzes.bulkPut(localQuizzes);
                        });
                        console.log(`Synced ${localQuizzes.length} quizzes.`);
                    }
                }
            }

            // ----------------------------------------------------
            // 1d. Fetch ANNOUNCEMENTS (New)
            // ----------------------------------------------------
            if (courseIds.length > 0) {
                const { data: announcementsData, error: annError } = await supabase
                    .from('announcements')
                    .select('*')
                    .in('course_id', courseIds);

                if (annError) {
                    console.error('Error fetching announcements:', annError);
                } else if (announcementsData) {
                    const localAnnouncements = announcementsData.map(a => ({
                        id: a.id,
                        courseId: a.course_id,
                        teacherId: a.teacher_id,
                        title: a.title,
                        content: a.content,
                        isUrgent: a.is_urgent,
                        createdAt: new Date(a.created_at).getTime(),
                        syncStatus: 'synced' as const
                    }));

                    await db.transaction('rw', db.announcements, async () => {
                        // Simple strategy: Put all. 
                        // Ideally we should verify if local Pending ones conflict, but for now server wins or we merge.
                        // Given unique IDs (UUIDs), bulkPut works well.
                        await db.announcements.bulkPut(localAnnouncements);
                    });
                    console.log(`Synced ${localAnnouncements.length} announcements.`);
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
