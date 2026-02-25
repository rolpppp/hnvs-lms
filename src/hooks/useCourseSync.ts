import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useAuth } from '../features/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Sync throttle – prevents hammering Supabase on every Dashboard render or
// React hot-reload. We persist the timestamp in localStorage so it survives
// page refreshes within the same browser session.
// ---------------------------------------------------------------------------
const SYNC_THROTTLE_MS = 3 * 60 * 1000; // 3 minutes

function getSyncThrottleKey(userId: string): string {
  return `hnvs_course_sync_${userId}`;
}

function isSyncThrottled(userId: string): boolean {
  try {
    const raw = localStorage.getItem(getSyncThrottleKey(userId));
    if (!raw) return false;
    return Date.now() - Number(raw) < SYNC_THROTTLE_MS;
  } catch {
    return false;
  }
}

function markSyncTime(userId: string): void {
  try {
    localStorage.setItem(getSyncThrottleKey(userId), String(Date.now()));
  } catch {
    // ignore
  }
}

export function useCourseSync() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const syncCourses = useCallback(async (force = false) => {
        if (!navigator.onLine) return;
        if (!user) return;

        if (!force && isSyncThrottled(user.id)) {
            console.log('Course sync throttled – skipping (last sync < 3 min ago).');
            return;
        }

        console.log('Syncing courses...');
        setLoading(true);
        setError(null);

        // Global 20-second abort so the UI never hangs indefinitely
        const controller = new AbortController();
        const abortTimer = window.setTimeout(() => controller.abort(), 20_000);

        try {
            // ----------------------------------------------------------------
            // Fetch courses visible to this user.
            // RLS policy "courses_select_enrolled_or_teacher" restricts
            // students to only their active enrollments, so this returns
            // exactly the courses that should appear on the dashboard.
            // ----------------------------------------------------------------
            const { data: allCourses, error: coursesError } = await supabase
                .from('courses')
                .select('id, code, title, description')
                .abortSignal(controller.signal);

            if (coursesError) throw coursesError;

            const remoteCourses = allCourses ?? [];
            const courseIds = remoteCourses.map(c => c.id);

            // Fetch my enrollment statuses separately (still needed to track
            // which courses are "downloaded" locally and for the sync badge)
            const { data: myEnrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('course_id, status, enrolled_at')
                .eq('student_id', user.id)
                .eq('status', 'active')
                .abortSignal(controller.signal);

            if (enrollError) throw enrollError;

            if (remoteCourses.length > 0) {
                // Bulk put (upsert) courses to local DB
                const coursesToSave = remoteCourses.map(c => ({
                    id: c.id,
                    code: c.code,
                    title: c.title,
                    description: c.description || '',
                    isDownloaded: false,
                }));

                await db.transaction('rw', db.courses, async () => {
                    // Remove any local courses the user no longer has access to
                    // (e.g. unenrolled, or stale data from a different logged-in user)
                    const remoteIdSet = new Set(courseIds);
                    const allLocal = await db.courses.toArray();
                    const staleIds = allLocal.filter(c => !remoteIdSet.has(c.id)).map(c => c.id);
                    if (staleIds.length > 0) {
                        await db.courses.bulkDelete(staleIds);
                        console.log(`Removed ${staleIds.length} stale course(s) from local DB.`);
                    }

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
                        .in('course_id', courseIds)
                        .abortSignal(controller.signal);

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
                        .eq('published', true)
                        .abortSignal(controller.signal);

                    if (quizError) console.error('Error fetching quizzes:', quizError);

                    if (quizzesData && quizzesData.length > 0) {
                        const quizIds = quizzesData.map(q => q.id);

                        // Fetch Questions
                        const { data: questionsData, error: qError } = await supabase
                            .from('quiz_questions')
                            .select('id, quiz_id, prompt, order')
                            .in('quiz_id', quizIds)
                            .order('order')
                            .abortSignal(controller.signal);

                        if (qError) console.error('Error fetching questions:', qError);

                        // Fetch Options
                        const questionIds = questionsData?.map(q => q.id) || [];
                        const { data: optionsData, error: oError } = await supabase
                            .from('quiz_options')
                            .select('id, question_id, label, is_correct')
                            .in('question_id', questionIds)
                            .abortSignal(controller.signal);

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
                    .in('course_id', courseIds)
                    .abortSignal(controller.signal);

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

            // 2. Persist enrollment records
            if (user && myEnrollments && myEnrollments.length > 0) {
                await db.transaction('rw', db.enrollments, async () => {
                    for (const e of myEnrollments) {
                        await db.enrollments.put({
                            courseId: e.course_id,
                            studentId: user.id,
                            status: (e.status as 'active' | 'inactive' | 'blocked') ?? 'active',
                            enrolledAt: e.enrolled_at ? new Date(e.enrolled_at).getTime() : Date.now(),
                        });
                    }
                });
            }

            markSyncTime(user.id);
            console.log('Courses synced successfully');

        } catch (err: any) {
            if (err?.name === 'AbortError' || controller.signal.aborted) {
                console.error('Course sync timed out after 20s');
                setError('Loading timed out — Supabase took too long. Try refreshing.');
            } else {
                console.error('Course sync failed:', err);
                setError(err.message ?? 'Sync failed');
            }
        } finally {
            clearTimeout(abortTimer);
            setLoading(false);
        }
    }, [user]);

    return { syncCourses, loading, error };
}
